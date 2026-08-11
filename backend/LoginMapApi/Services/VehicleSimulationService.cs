using System.Collections.Concurrent;
using LoginMapApi.Data;
using LoginMapApi.Hubs;
using LoginMapApi.Models;
using LoginMapApi.Services.Interfaces;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace LoginMapApi.Services;

public class VehicleSimulationService : IVehicleSimulationService
{
    private readonly ConcurrentDictionary<Guid, VehicleSimulationState>
        _simulations = new();

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<VehicleHub> _hubContext;
    private readonly IConfiguration _configuration;

    public VehicleSimulationService(
        IServiceScopeFactory scopeFactory,
        IHubContext<VehicleHub> hubContext,
        IConfiguration configuration
    )
    {
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
        _configuration = configuration;
    }

    public async Task<VehicleSimulationState> StartTripAsync(
        int tripId,
        int startedByUserId,
        bool isAutomatic = false,
        string? vehicleCode = null,
        CancellationToken cancellationToken = default
    )
    {
        if (tripId <= 0)
        {
            throw new InvalidOperationException(
                "Geçerli bir sefer seçilmelidir."
            );
        }

        await using var scope = _scopeFactory.CreateAsyncScope();

        var context = scope.ServiceProvider
            .GetRequiredService<AppDbContext>();

        var trip = await context.TransitTrips
            .AsNoTracking()
            .Where(item =>
                item.Id == tripId &&
                item.IsActive &&
                !item.IsDeleted
            )
            .Include(item => item.TransitRoute)
            .Include(item => item.TransitSchedule)
            .Include(item => item.Stops)
                .ThenInclude(item => item.TransitStop)
            .FirstOrDefaultAsync(cancellationToken);

        if (trip == null)
        {
            throw new InvalidOperationException("Sefer bulunamadı.");
        }

        var route = trip.TransitRoute;

        if (
            route == null ||
            !route.IsActive ||
            route.IsDeleted
        )
        {
            throw new InvalidOperationException(
                "Seferin bağlı olduğu aktif güzergah bulunamadı."
            );
        }

        if (string.IsNullOrWhiteSpace(route.RouteWkt))
        {
            throw new InvalidOperationException(
                "Bu güzergah için önce OSRM rotası oluşturulmalıdır."
            );
        }

        var orderedTripStops = trip.Stops
            .Where(item =>
                item.TransitStop != null &&
                item.TransitStop.IsActive &&
                !item.TransitStop.IsDeleted &&
                item.TransitStop.Geometry != null
            )
            .OrderBy(item => item.StopSequence)
            .ThenBy(item => item.Id)
            .ToList();

        if (orderedTripStops.Count < 2)
        {
            throw new InvalidOperationException(
                "Simülasyonu başlatmak için sefer üzerinde en az 2 aktif durak bulunmalıdır."
            );
        }

        var vehicleType = NormalizeVehicleType(
            trip.VehicleType
        );

        var routeGeometry = ReadLineGeometry(
            route.RouteWkt
        );

        var routeMeasure = BuildRouteMeasure(
            routeGeometry
        );

        if (routeMeasure.TotalLengthMeters <= 0)
        {
            throw new InvalidOperationException(
                "Rota uzunluğu hesaplanamadı."
            );
        }

        var simulationStops =
            new List<VehicleSimulationStopState>();

        var previousStopDistance = 0.0;

        foreach (var tripStop in orderedTripStops)
        {
            var stop = tripStop.TransitStop!;
            var stopCoordinate = stop.Geometry?.Coordinate;

            if (stopCoordinate == null)
            {
                continue;
            }

            var projectedDistance =
                ProjectCoordinateToRouteMeters(
                    routeMeasure,
                    stopCoordinate
                );

            projectedDistance = Math.Max(
                previousStopDistance,
                projectedDistance
            );

            previousStopDistance = projectedDistance;

            simulationStops.Add(
                new VehicleSimulationStopState
                {
                    StopId = stop.Id,
                    StopName = stop.Name,
                    OrderNo = tripStop.StopSequence,
                    RouteDistanceMeters = projectedDistance,
                    RouteProgress =
                        projectedDistance /
                        routeMeasure.TotalLengthMeters *
                        100.0,
                    Longitude = stopCoordinate.X,
                    Latitude = stopCoordinate.Y,
                    IsVisited = false,
                    DwellDurationSeconds = Math.Clamp(
                        tripStop.DwellSeconds,
                        0,
                        600
                    ),
                    WaitedSeconds = 0
                }
            );
        }

        if (simulationStops.Count < 2)
        {
            throw new InvalidOperationException(
                "Simülasyon için rota üzerinde en az 2 geçerli durak bulunmalıdır."
            );
        }

        var startDistance = Math.Clamp(
            simulationStops[0].RouteDistanceMeters,
            0,
            routeMeasure.TotalLengthMeters
        );

        var startCoordinate =
            GetCoordinateAtDistanceMeters(
                routeMeasure,
                startDistance
            );

        var simulationId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        var normalizedVehicleCode =
            string.IsNullOrWhiteSpace(vehicleCode)
                ? $"{trip.TripCode}-{simulationId.ToString("N")[..6].ToUpperInvariant()}"
                : vehicleCode.Trim();

        var state = new VehicleSimulationState
        {
            SimulationId = simulationId,
            TripId = trip.Id,
            TripCode = trip.TripCode,
            VehicleCode = normalizedVehicleCode,
            ServiceDate = DateOnly.FromDateTime(now),
            DepartureTime = trip.DepartureTime,
            IsAutomatic = isAutomatic,

            RouteId = route.Id,
            RouteName = route.Name,
            ShortCode = route.ShortCode,
            RouteColor = route.Color,
            VehicleType = vehicleType,
            IsRunning = true,
            Progress =
                startDistance /
                routeMeasure.TotalLengthMeters *
                100.0,
            Longitude = startCoordinate.X,
            Latitude = startCoordinate.Y,
            StartedByUserId = startedByUserId,
            StartedDate = now,
            LastUpdatedDate = now,
            SimulationDurationSeconds = 0,
            RouteWkt = route.RouteWkt,
            CurrentSpeedKmh = 0,
            MaxSpeedKmh = GetMaximumSpeedKmh(vehicleType),
            TravelledDistanceMeters = startDistance,
            RouteLengthMeters = routeMeasure.TotalLengthMeters,
            PreviousStopId = simulationStops[0].StopId,
            PreviousStopName = simulationStops[0].StopName,
            NextStopId = simulationStops[1].StopId,
            NextStopName = simulationStops[1].StopName,
            DistanceToNextStopMeters = Math.Max(
                0,
                simulationStops[1].RouteDistanceMeters -
                startDistance
            ),
            EstimatedArrivalSeconds = null,
            Status = "WaitingAtStart",
            Stops = simulationStops,
            NextStopIndex = 1,
            IsWaitingAtStop = false,
            WaitingStopId = null,
            WaitingStopName = "",
            CurrentStopWaitSeconds = 0,
            StopDwellDurationSeconds =
                simulationStops[0].DwellDurationSeconds,
            RemainingStopWaitSeconds = 0,
            DepartingStateRemainingSeconds = 0,
            InitialStopProcessed = true
        };

        simulationStops[0].IsVisited = true;

        UpdateEstimatedArrival(state);

        if (!_simulations.TryAdd(
                simulationId,
                state
            ))
        {
            throw new InvalidOperationException(
                "Araç simülasyonu oluşturulamadı."
            );
        }

        await BroadcastLocationAsync(
            state,
            cancellationToken
        );

        return CloneState(state);
    }

    public async Task<bool> StopSimulationAsync(
        Guid simulationId,
        CancellationToken cancellationToken = default
    )
    {
        if (simulationId == Guid.Empty)
        {
            return false;
        }

        if (!_simulations.TryRemove(
                simulationId,
                out var state
            ))
        {
            return false;
        }

        lock (state)
        {
            state.IsRunning = false;
            state.CurrentSpeedKmh = 0;
            state.Status = "Stopped";
            state.LastUpdatedDate = DateTime.UtcNow;
        }

        await _hubContext.Clients
            .Group(
                VehicleHub.GetRouteGroupName(
                    state.RouteId
                )
            )
            .SendAsync(
                "VehicleSimulationStopped",
                ToClientPayload(state),
                cancellationToken
            );

        return true;
    }

    public async Task<int> StopTripSimulationsAsync(
        int tripId,
        CancellationToken cancellationToken = default
    )
    {
        var simulationIds = _simulations
            .Where(item => item.Value.TripId == tripId)
            .Select(item => item.Key)
            .ToList();

        var stoppedCount = 0;

        foreach (var simulationId in simulationIds)
        {
            if (
                await StopSimulationAsync(
                    simulationId,
                    cancellationToken
                )
            )
            {
                stoppedCount++;
            }
        }

        return stoppedCount;
    }

    public async Task<int> StopRouteSimulationsAsync(
        int routeId,
        CancellationToken cancellationToken = default
    )
    {
        var simulationIds = _simulations
            .Where(item => item.Value.RouteId == routeId)
            .Select(item => item.Key)
            .ToList();

        var stoppedCount = 0;

        foreach (var simulationId in simulationIds)
        {
            if (
                await StopSimulationAsync(
                    simulationId,
                    cancellationToken
                )
            )
            {
                stoppedCount++;
            }
        }

        return stoppedCount;
    }

    public VehicleSimulationState? GetState(
        Guid simulationId
    )
    {
        return _simulations.TryGetValue(
            simulationId,
            out var state
        )
            ? CloneState(state)
            : null;
    }

    public IReadOnlyCollection<VehicleSimulationState>
        GetTripSimulations(
            int tripId
        )
    {
        return _simulations.Values
            .Where(state =>
                state.IsRunning &&
                state.TripId == tripId
            )
            .Select(CloneState)
            .ToList();
    }

    public IReadOnlyCollection<VehicleSimulationState>
        GetRouteSimulations(
            int routeId
        )
    {
        return _simulations.Values
            .Where(state =>
                state.IsRunning &&
                state.RouteId == routeId
            )
            .Select(CloneState)
            .ToList();
    }

    public IReadOnlyCollection<VehicleSimulationState>
        GetRunningSimulations()
    {
        return _simulations.Values
            .Where(state => state.IsRunning)
            .Select(CloneState)
            .ToList();
    }

    public async Task TickAsync(
        TimeSpan elapsed,
        CancellationToken cancellationToken = default
    )
    {
        var completedSimulationIds = new List<Guid>();

        var realElapsedSeconds = Math.Max(
            0,
            elapsed.TotalSeconds
        );

        var timeScale = Math.Clamp(
            _configuration.GetValue<double?>(
                "VehicleSimulation:TimeScale"
            ) ?? 1,
            1,
            1000
        );

        var movementElapsedSeconds =
            realElapsedSeconds * timeScale;

        if (realElapsedSeconds <= 0)
        {
            return;
        }

        foreach (var simulationPair in _simulations)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var state = simulationPair.Value;

            if (!state.IsRunning)
            {
                continue;
            }

            lock (state)
            {
                UpdateSimulationState(
                    state,
                    movementElapsedSeconds,
                    realElapsedSeconds
                );

                if (
                    !state.IsRunning &&
                    state.Status == "Completed"
                )
                {
                    completedSimulationIds.Add(
                        state.SimulationId
                    );
                }
            }

            await BroadcastLocationAsync(
                state,
                cancellationToken
            );
        }

        foreach (var simulationId in completedSimulationIds)
        {
            if (
                !_simulations.TryRemove(
                    simulationId,
                    out var completedState
                )
            )
            {
                continue;
            }

            await _hubContext.Clients
                .Group(
                    VehicleHub.GetRouteGroupName(
                        completedState.RouteId
                    )
                )
                .SendAsync(
                    "VehicleSimulationCompleted",
                    ToClientPayload(completedState),
                    cancellationToken
                );
        }
    }

    private void UpdateSimulationState(
        VehicleSimulationState state,
        double movementElapsedSeconds,
        double realElapsedSeconds
    )
    {
        var routeGeometry = ReadLineGeometry(state.RouteWkt);
        var routeMeasure = BuildRouteMeasure(routeGeometry);

        if (
            routeMeasure.TotalLengthMeters <= 0 ||
            state.Stops.Count < 2
        )
        {
            state.IsRunning = false;
            state.CurrentSpeedKmh = 0;
            state.Status = "Stopped";
            state.LastUpdatedDate = DateTime.UtcNow;
            return;
        }

        state.RouteLengthMeters = routeMeasure.TotalLengthMeters;

        if (state.IsWaitingAtStop)
        {
            ProcessStopDwell(state, realElapsedSeconds);
            state.LastUpdatedDate = DateTime.UtcNow;
            UpdateEstimatedArrival(state);
            return;
        }

        if (state.DepartingStateRemainingSeconds > 0)
        {
            state.DepartingStateRemainingSeconds = Math.Max(
                0,
                state.DepartingStateRemainingSeconds - realElapsedSeconds
            );
        }

        if (state.NextStopIndex >= state.Stops.Count)
        {
            CompleteSimulation(state, routeMeasure);
            return;
        }

        var nextStop = state.Stops[state.NextStopIndex];
        var distanceToStop = Math.Max(
            0,
            nextStop.RouteDistanceMeters -
            state.TravelledDistanceMeters
        );

        var acceleration = GetAccelerationMetersPerSecondSquared();
        var braking = GetBrakingMetersPerSecondSquared();
        var arrivalTolerance = GetArrivalToleranceMeters();
        var maxSpeedMetersPerSecond =
            Math.Max(0.1, state.MaxSpeedKmh / 3.6);
        var currentSpeedMetersPerSecond =
            Math.Max(0, state.CurrentSpeedKmh / 3.6);

        /*
         * Durağa güvenli şekilde sıfır hızla varabilmek için gereken mesafe.
         * v² / (2a)
         */
        var brakingDistance =
            currentSpeedMetersPerSecond *
            currentSpeedMetersPerSecond /
            (2 * Math.Max(0.1, braking));

        /*
         * Kalan mesafeye göre izin verilen en yüksek hız:
         * v = sqrt(2as)
         */
        var stopLimitedSpeed = Math.Sqrt(
            Math.Max(
                0,
                2 * braking * Math.Max(0, distanceToStop)
            )
        );

        var targetSpeedMetersPerSecond = Math.Min(
            maxSpeedMetersPerSecond,
            stopLimitedSpeed
        );

        if (distanceToStop <= arrivalTolerance)
        {
            ArriveAtStop(state, nextStop, routeMeasure);
            return;
        }

        if (
            distanceToStop <= brakingDistance + arrivalTolerance ||
            targetSpeedMetersPerSecond < currentSpeedMetersPerSecond
        )
        {
            currentSpeedMetersPerSecond = Math.Max(
                targetSpeedMetersPerSecond,
                currentSpeedMetersPerSecond - braking * movementElapsedSeconds
            );

            state.Status = "ApproachingStop";
        }
        else if (
            currentSpeedMetersPerSecond <
            maxSpeedMetersPerSecond - 0.05
        )
        {
            currentSpeedMetersPerSecond = Math.Min(
                maxSpeedMetersPerSecond,
                currentSpeedMetersPerSecond +
                acceleration * movementElapsedSeconds
            );

            state.Status = "Accelerating";
        }
        else
        {
            currentSpeedMetersPerSecond = maxSpeedMetersPerSecond;
            state.Status = "Cruising";
        }

        var movementMeters =
            currentSpeedMetersPerSecond * movementElapsedSeconds;

        /* Durağı geçme; hedefin tam üzerinde dur. */
        if (movementMeters >= distanceToStop)
        {
            ArriveAtStop(state, nextStop, routeMeasure);
            return;
        }

        state.TravelledDistanceMeters = Math.Clamp(
            state.TravelledDistanceMeters + movementMeters,
            0,
            state.RouteLengthMeters
        );

        var currentCoordinate = GetCoordinateAtDistanceMeters(
            routeMeasure,
            state.TravelledDistanceMeters
        );

        state.Longitude = currentCoordinate.X;
        state.Latitude = currentCoordinate.Y;
        state.CurrentSpeedKmh =
            currentSpeedMetersPerSecond * 3.6;
        state.Progress =
            state.TravelledDistanceMeters /
            state.RouteLengthMeters *
            100.0;
        state.DistanceToNextStopMeters = Math.Max(
            0,
            nextStop.RouteDistanceMeters -
            state.TravelledDistanceMeters
        );
        state.NextStopId = nextStop.StopId;
        state.NextStopName = nextStop.StopName;
        if (state.DepartingStateRemainingSeconds > 0)
        {
            state.Status = "DepartingStop";
        }

        state.LastUpdatedDate = DateTime.UtcNow;

        UpdateEstimatedArrival(state);
    }

    private void ArriveAtStop(
        VehicleSimulationState state,
        VehicleSimulationStopState arrivedStop,
        RouteMeasure routeMeasure
    )
    {
        state.TravelledDistanceMeters = Math.Clamp(
            arrivedStop.RouteDistanceMeters,
            0,
            routeMeasure.TotalLengthMeters
        );

        var stopCoordinate = GetCoordinateAtDistanceMeters(
            routeMeasure,
            state.TravelledDistanceMeters
        );

        state.Longitude = stopCoordinate.X;
        state.Latitude = stopCoordinate.Y;
        state.CurrentSpeedKmh = 0;
        state.Progress =
            state.TravelledDistanceMeters /
            Math.Max(1, state.RouteLengthMeters) *
            100.0;
        state.PreviousStopId = arrivedStop.StopId;
        state.PreviousStopName = arrivedStop.StopName;
        state.Status = "ArrivedAtStop";
        state.LastUpdatedDate = DateTime.UtcNow;

        arrivedStop.IsVisited = true;
        arrivedStop.WaitedSeconds = 0;

        state.NextStopIndex += 1;

        if (state.NextStopIndex >= state.Stops.Count)
        {
            CompleteSimulation(state, routeMeasure);
            return;
        }

        var followingStop = state.Stops[state.NextStopIndex];

        state.NextStopId = followingStop.StopId;
        state.NextStopName = followingStop.StopName;
        state.DistanceToNextStopMeters = Math.Max(
            0,
            followingStop.RouteDistanceMeters -
            state.TravelledDistanceMeters
        );

        BeginStopDwell(state, arrivedStop);
        UpdateEstimatedArrival(state);
    }

    private void BeginStopDwell(
        VehicleSimulationState state,
        VehicleSimulationStopState arrivedStop
    )
    {
        var dwellDuration = arrivedStop.DwellDurationSeconds > 0
            ? arrivedStop.DwellDurationSeconds
            : GetStopDwellSeconds();

        state.IsWaitingAtStop = dwellDuration > 0;
        state.WaitingStopId = arrivedStop.StopId;
        state.WaitingStopName = arrivedStop.StopName;
        state.CurrentStopWaitSeconds = 0;
        state.StopDwellDurationSeconds = dwellDuration;
        state.RemainingStopWaitSeconds = dwellDuration;
        state.CurrentSpeedKmh = 0;
        state.Status = dwellDuration > 0
            ? "WaitingAtStop"
            : "DepartingStop";

        if (dwellDuration <= 0)
        {
            state.WaitingStopId = null;
            state.WaitingStopName = "";
            state.DepartingStateRemainingSeconds = 2;
        }
    }

    private static void ProcessStopDwell(
        VehicleSimulationState state,
        double realElapsedSeconds
    )
    {
        state.CurrentSpeedKmh = 0;
        state.Status = "WaitingAtStop";
        state.CurrentStopWaitSeconds = Math.Min(
            state.StopDwellDurationSeconds,
            state.CurrentStopWaitSeconds + realElapsedSeconds
        );
        state.RemainingStopWaitSeconds = Math.Max(
            0,
            state.StopDwellDurationSeconds -
            state.CurrentStopWaitSeconds
        );

        var waitingStop = state.Stops.FirstOrDefault(
            stop => stop.StopId == state.WaitingStopId
        );

        if (waitingStop != null)
        {
            waitingStop.WaitedSeconds = state.CurrentStopWaitSeconds;
        }

        if (state.RemainingStopWaitSeconds > 0)
        {
            return;
        }

        state.IsWaitingAtStop = false;
        state.WaitingStopId = null;
        state.WaitingStopName = "";
        state.CurrentStopWaitSeconds = 0;
        state.RemainingStopWaitSeconds = 0;
        state.DepartingStateRemainingSeconds = 2;
        state.Status = "DepartingStop";
    }

    private static void CompleteSimulation(
        VehicleSimulationState state,
        RouteMeasure routeMeasure
    )
    {
        var finalDistance = state.Stops.Count > 0
            ? state.Stops[^1].RouteDistanceMeters
            : routeMeasure.TotalLengthMeters;

        state.TravelledDistanceMeters = Math.Clamp(
            finalDistance,
            0,
            routeMeasure.TotalLengthMeters
        );

        var finalCoordinate = GetCoordinateAtDistanceMeters(
            routeMeasure,
            state.TravelledDistanceMeters
        );

        state.Longitude = finalCoordinate.X;
        state.Latitude = finalCoordinate.Y;
        state.CurrentSpeedKmh = 0;
        state.Progress = 100;
        state.IsRunning = false;
        state.Status = "Completed";
        state.IsWaitingAtStop = false;
        state.WaitingStopId = null;
        state.WaitingStopName = "";
        state.CurrentStopWaitSeconds = 0;
        state.RemainingStopWaitSeconds = 0;
        state.DepartingStateRemainingSeconds = 0;
        state.NextStopId = null;
        state.NextStopName = "";
        state.DistanceToNextStopMeters = 0;
        state.EstimatedArrivalSeconds = 0;
        state.LastUpdatedDate = DateTime.UtcNow;
    }

    private static void UpdateEstimatedArrival(
        VehicleSimulationState state
    )
    {
        if (!state.DistanceToNextStopMeters.HasValue)
        {
            state.EstimatedArrivalSeconds = null;
            return;
        }

        var distance = Math.Max(
            0,
            state.DistanceToNextStopMeters.Value
        );

        if (distance <= 0)
        {
            state.EstimatedArrivalSeconds = 0;
            return;
        }

        var speedMetersPerSecond =
            state.CurrentSpeedKmh / 3.6;

        /*
         * Araç henüz çok yavaşsa sıfıra bölmemek ve anlamsız büyük değer
         * üretmemek için en az 5 km/sa hesap hızı kullanılır.
         */
        var calculationSpeed = Math.Max(
            speedMetersPerSecond,
            5.0 / 3.6
        );

        state.EstimatedArrivalSeconds =
            distance / calculationSpeed +
            Math.Max(0, state.RemainingStopWaitSeconds);
    }

    private async Task BroadcastLocationAsync(
        VehicleSimulationState state,
        CancellationToken cancellationToken
    )
    {
        await _hubContext.Clients
            .Group(
                VehicleHub.GetRouteGroupName(
                    state.RouteId
                )
            )
            .SendAsync(
                "VehicleLocationUpdated",
                ToClientPayload(state),
                cancellationToken
            );
    }

    private static object ToClientPayload(
        VehicleSimulationState state
    )
    {
        return new
        {
            state.SimulationId,
            state.TripId,
            state.TripCode,
            state.VehicleCode,
            state.ServiceDate,
            DepartureTime =
                state.DepartureTime.ToString("HH:mm:ss"),
            state.IsAutomatic,

            state.RouteId,
            state.RouteName,
            state.ShortCode,
            state.RouteColor,
            state.VehicleType,
            state.IsRunning,

            Progress = Math.Round(
                state.Progress,
                2
            ),

            state.Longitude,
            state.Latitude,

            CurrentSpeedKmh = Math.Round(
                state.CurrentSpeedKmh,
                1
            ),

            MaxSpeedKmh = Math.Round(
                state.MaxSpeedKmh,
                1
            ),

            TravelledDistanceMeters = Math.Round(
                state.TravelledDistanceMeters,
                1
            ),

            RouteLengthMeters = Math.Round(
                state.RouteLengthMeters,
                1
            ),

            state.PreviousStopId,
            state.PreviousStopName,
            state.NextStopId,
            state.NextStopName,

            DistanceToNextStopMeters =
                state.DistanceToNextStopMeters.HasValue
                    ? (double?)Math.Round(
                        state.DistanceToNextStopMeters.Value,
                        1
                    )
                    : null,

            EstimatedArrivalSeconds =
                state.EstimatedArrivalSeconds.HasValue
                    ? (double?)Math.Round(
                        state.EstimatedArrivalSeconds.Value,
                        1
                    )
                    : null,

            state.IsWaitingAtStop,
            state.WaitingStopId,
            state.WaitingStopName,

            CurrentStopWaitSeconds = Math.Round(
                state.CurrentStopWaitSeconds,
                1
            ),

            StopDwellDurationSeconds = Math.Round(
                state.StopDwellDurationSeconds,
                1
            ),

            RemainingStopWaitSeconds = Math.Round(
                state.RemainingStopWaitSeconds,
                1
            ),

            state.Status,
            state.StartedByUserId,
            state.StartedDate,
            state.LastUpdatedDate
        };
    }

    private static VehicleSimulationState CloneState(
        VehicleSimulationState state
    )
    {
        lock (state)
        {
            return new VehicleSimulationState
            {
                SimulationId = state.SimulationId,
                TripId = state.TripId,
                TripCode = state.TripCode,
                VehicleCode = state.VehicleCode,
                ServiceDate = state.ServiceDate,
                DepartureTime = state.DepartureTime,
                IsAutomatic = state.IsAutomatic,

                RouteId = state.RouteId,
                RouteName = state.RouteName,
                ShortCode = state.ShortCode,
                RouteColor = state.RouteColor,
                VehicleType = state.VehicleType,
                IsRunning = state.IsRunning,
                Progress = state.Progress,
                Longitude = state.Longitude,
                Latitude = state.Latitude,
                StartedByUserId = state.StartedByUserId,
                StartedDate = state.StartedDate,
                LastUpdatedDate = state.LastUpdatedDate,
                SimulationDurationSeconds =
                    state.SimulationDurationSeconds,
                RouteWkt = state.RouteWkt,
                CurrentSpeedKmh = state.CurrentSpeedKmh,
                MaxSpeedKmh = state.MaxSpeedKmh,
                TravelledDistanceMeters =
                    state.TravelledDistanceMeters,
                RouteLengthMeters =
                    state.RouteLengthMeters,
                PreviousStopId = state.PreviousStopId,
                PreviousStopName = state.PreviousStopName,
                NextStopId = state.NextStopId,
                NextStopName = state.NextStopName,
                DistanceToNextStopMeters =
                    state.DistanceToNextStopMeters,
                EstimatedArrivalSeconds =
                    state.EstimatedArrivalSeconds,
                Status = state.Status,
                NextStopIndex = state.NextStopIndex,
                IsWaitingAtStop = state.IsWaitingAtStop,
                WaitingStopId = state.WaitingStopId,
                WaitingStopName = state.WaitingStopName,
                CurrentStopWaitSeconds =
                    state.CurrentStopWaitSeconds,
                StopDwellDurationSeconds =
                    state.StopDwellDurationSeconds,
                RemainingStopWaitSeconds =
                    state.RemainingStopWaitSeconds,
                DepartingStateRemainingSeconds =
                    state.DepartingStateRemainingSeconds,
                InitialStopProcessed =
                    state.InitialStopProcessed,

                Stops = state.Stops
                    .Select(stop =>
                        new VehicleSimulationStopState
                        {
                            StopId = stop.StopId,
                            StopName = stop.StopName,
                            OrderNo = stop.OrderNo,
                            RouteDistanceMeters =
                                stop.RouteDistanceMeters,
                            RouteProgress =
                                stop.RouteProgress,
                            Longitude = stop.Longitude,
                            Latitude = stop.Latitude,
                            IsVisited = stop.IsVisited,
                            DwellDurationSeconds =
                                stop.DwellDurationSeconds,
                            WaitedSeconds =
                                stop.WaitedSeconds
                        })
                    .ToList()
            };
        }
    }

    private double GetMaximumSpeedKmh(string vehicleType)
    {
        var configurationKey = vehicleType == "Metro"
            ? "VehicleSimulation:MetroMaxSpeedKmh"
            : "VehicleSimulation:BusMaxSpeedKmh";

        var fallback = vehicleType == "Metro" ? 80.0 : 50.0;

        return Math.Clamp(
            _configuration.GetValue<double?>(configurationKey) ?? fallback,
            5,
            160
        );
    }

    private double GetAccelerationMetersPerSecondSquared()
    {
        return Math.Clamp(
            _configuration.GetValue<double?>(
                "VehicleSimulation:AccelerationMetersPerSecondSquared"
            ) ?? 1.2,
            0.1,
            5
        );
    }

    private double GetBrakingMetersPerSecondSquared()
    {
        return Math.Clamp(
            _configuration.GetValue<double?>(
                "VehicleSimulation:BrakingMetersPerSecondSquared"
            ) ?? 1.8,
            0.1,
            8
        );
    }

    private double GetArrivalToleranceMeters()
    {
        return Math.Clamp(
            _configuration.GetValue<double?>(
                "VehicleSimulation:StopArrivalToleranceMeters"
            ) ?? 5,
            0.5,
            25
        );
    }

    private double GetStopDwellSeconds()
    {
        return Math.Clamp(
            _configuration.GetValue<double?>(
                "VehicleSimulation:StopDwellSeconds"
            ) ?? 10,
            0,
            300
        );
    }

    private static string NormalizeVehicleType(string? stopType)
    {
        return string.Equals(
            stopType?.Trim(),
            "Metro",
            StringComparison.OrdinalIgnoreCase
        )
            ? "Metro"
            : "Bus";
    }

    private static LineString ReadLineGeometry(string routeWkt)
    {
        var geometry = new WKTReader().Read(routeWkt);

        if (geometry is LineString lineString)
        {
            return lineString;
        }

        if (
            geometry is MultiLineString multiLineString &&
            multiLineString.NumGeometries > 0
        )
        {
            var coordinates = multiLineString.Geometries
                .OfType<LineString>()
                .SelectMany(line => line.Coordinates)
                .ToArray();

            if (coordinates.Length >= 2)
            {
                return geometry.Factory.CreateLineString(coordinates);
            }
        }

        throw new InvalidOperationException(
            "RouteWkt geçerli bir LINESTRING geometrisi değildir."
        );
    }

    private static RouteMeasure BuildRouteMeasure(
        LineString lineString
    )
    {
        var coordinates = lineString.Coordinates;

        if (coordinates.Length < 2)
        {
            throw new InvalidOperationException(
                "Rota geometrisinde en az iki koordinat bulunmalıdır."
            );
        }

        var cumulativeDistances = new double[coordinates.Length];

        for (var index = 1; index < coordinates.Length; index++)
        {
            cumulativeDistances[index] =
                cumulativeDistances[index - 1] +
                CalculateDistanceMeters(
                    coordinates[index - 1],
                    coordinates[index]
                );
        }

        return new RouteMeasure(
            coordinates,
            cumulativeDistances,
            cumulativeDistances[^1]
        );
    }

    private static Coordinate GetCoordinateAtDistanceMeters(
        RouteMeasure routeMeasure,
        double distanceMeters
    )
    {
        var safeDistance = Math.Clamp(
            distanceMeters,
            0,
            routeMeasure.TotalLengthMeters
        );

        if (safeDistance <= 0)
        {
            return new Coordinate(routeMeasure.Coordinates[0]);
        }

        if (safeDistance >= routeMeasure.TotalLengthMeters)
        {
            return new Coordinate(routeMeasure.Coordinates[^1]);
        }

        var segmentIndex = Array.BinarySearch(
            routeMeasure.CumulativeDistancesMeters,
            safeDistance
        );

        if (segmentIndex >= 0)
        {
            return new Coordinate(
                routeMeasure.Coordinates[segmentIndex]
            );
        }

        segmentIndex = ~segmentIndex;
        var endIndex = Math.Clamp(
            segmentIndex,
            1,
            routeMeasure.Coordinates.Length - 1
        );
        var startIndex = endIndex - 1;

        var segmentStartDistance =
            routeMeasure.CumulativeDistancesMeters[startIndex];
        var segmentEndDistance =
            routeMeasure.CumulativeDistancesMeters[endIndex];
        var segmentLength = Math.Max(
            0.000001,
            segmentEndDistance - segmentStartDistance
        );
        var ratio = Math.Clamp(
            (safeDistance - segmentStartDistance) / segmentLength,
            0,
            1
        );

        var start = routeMeasure.Coordinates[startIndex];
        var end = routeMeasure.Coordinates[endIndex];

        return new Coordinate(
            start.X + (end.X - start.X) * ratio,
            start.Y + (end.Y - start.Y) * ratio
        );
    }

    private static double ProjectCoordinateToRouteMeters(
        RouteMeasure routeMeasure,
        Coordinate coordinate
    )
    {
        var nearestDistanceSquared = double.PositiveInfinity;
        var nearestRouteDistanceMeters = 0.0;

        for (
            var index = 0;
            index < routeMeasure.Coordinates.Length - 1;
            index++
        )
        {
            var start = routeMeasure.Coordinates[index];
            var end = routeMeasure.Coordinates[index + 1];

            var projection = ProjectCoordinateToSegment(
                coordinate,
                start,
                end
            );

            if (projection.DistanceSquared < nearestDistanceSquared)
            {
                nearestDistanceSquared = projection.DistanceSquared;

                var segmentStartDistance =
                    routeMeasure.CumulativeDistancesMeters[index];
                var segmentLength =
                    routeMeasure.CumulativeDistancesMeters[index + 1] -
                    segmentStartDistance;

                nearestRouteDistanceMeters =
                    segmentStartDistance +
                    segmentLength * projection.Ratio;
            }
        }

        return Math.Clamp(
            nearestRouteDistanceMeters,
            0,
            routeMeasure.TotalLengthMeters
        );
    }

    private static SegmentProjection ProjectCoordinateToSegment(
        Coordinate point,
        Coordinate start,
        Coordinate end
    )
    {
        /*
         * Küçük yerel alanlarda boylamı enlem kosinüsüyle ölçekleyerek
         * Öklid izdüşümü yapıyoruz. Bu, durakları rota üzerine metre
         * hesabına uygun ve yeterince hassas biçimde yerleştirir.
         */
        var referenceLatitudeRadians =
            DegreesToRadians((start.Y + end.Y + point.Y) / 3.0);
        var longitudeScale = Math.Cos(referenceLatitudeRadians);

        var startX = start.X * longitudeScale;
        var endX = end.X * longitudeScale;
        var pointX = point.X * longitudeScale;

        var deltaX = endX - startX;
        var deltaY = end.Y - start.Y;
        var lengthSquared = deltaX * deltaX + deltaY * deltaY;

        if (lengthSquared <= 0)
        {
            var differenceX = pointX - startX;
            var differenceY = point.Y - start.Y;

            return new SegmentProjection(
                0,
                differenceX * differenceX +
                differenceY * differenceY
            );
        }

        var rawRatio =
            ((pointX - startX) * deltaX +
             (point.Y - start.Y) * deltaY) /
            lengthSquared;

        var ratio = Math.Clamp(rawRatio, 0, 1);
        var projectedX = startX + deltaX * ratio;
        var projectedY = start.Y + deltaY * ratio;
        var distanceX = pointX - projectedX;
        var distanceY = point.Y - projectedY;

        return new SegmentProjection(
            ratio,
            distanceX * distanceX +
            distanceY * distanceY
        );
    }

    private static double CalculateDistanceMeters(
        Coordinate first,
        Coordinate second
    )
    {
        const double earthRadiusMeters = 6_371_000;

        var latitude1 = DegreesToRadians(first.Y);
        var latitude2 = DegreesToRadians(second.Y);
        var latitudeDifference =
            DegreesToRadians(second.Y - first.Y);
        var longitudeDifference =
            DegreesToRadians(second.X - first.X);

        var haversine =
            Math.Sin(latitudeDifference / 2) *
            Math.Sin(latitudeDifference / 2) +
            Math.Cos(latitude1) *
            Math.Cos(latitude2) *
            Math.Sin(longitudeDifference / 2) *
            Math.Sin(longitudeDifference / 2);

        var angularDistance = 2 * Math.Atan2(
            Math.Sqrt(haversine),
            Math.Sqrt(Math.Max(0, 1 - haversine))
        );

        return earthRadiusMeters * angularDistance;
    }

    private static double DegreesToRadians(double degrees)
    {
        return degrees * Math.PI / 180.0;
    }

    private sealed record RouteMeasure(
        Coordinate[] Coordinates,
        double[] CumulativeDistancesMeters,
        double TotalLengthMeters
    );

    private sealed record SegmentProjection(
        double Ratio,
        double DistanceSquared
    );
}
