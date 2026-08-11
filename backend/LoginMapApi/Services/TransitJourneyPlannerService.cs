using LoginMapApi.Data;
using LoginMapApi.Models;
using LoginMapApi.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.IO;

namespace LoginMapApi.Services;

public class TransitJourneyPlannerService : ITransitJourneyPlannerService
{
    private readonly AppDbContext _context;
    private readonly IWalkingRouteService _walkingRouteService;

    private readonly double _maximumWalkingDistanceMeters;
    private readonly int _maximumSearchDays;

    public TransitJourneyPlannerService(
        AppDbContext context,
        IWalkingRouteService walkingRouteService,
        IConfiguration configuration
    )
    {
        _context = context;
        _walkingRouteService = walkingRouteService;

        _maximumWalkingDistanceMeters =
            Math.Clamp(
                configuration.GetValue<double?>(
                    "TransitJourneyPlanner:MaximumWalkingDistanceMeters"
                ) ?? 5000,
                500,
                10000
            );

        _maximumSearchDays =
            Math.Clamp(
                configuration.GetValue<int?>(
                    "TransitJourneyPlanner:MaximumSearchDays"
                ) ?? 14,
                1,
                30
            );
    }

    public async Task<TransitJourneyPlanResult> PlanAsync(
        TransitJourneyPlanRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ValidateRequest(request);

        var requestedDepartureDateTime =
            request.DepartureDateTime ?? DateTime.Now;

        var maximumWalkingDistanceMeters =
            Math.Clamp(
                request.MaximumWalkingDistanceMeters,
                100,
                _maximumWalkingDistanceMeters
            );

        var candidateStopCount =
            Math.Clamp(request.CandidateStopCount, 2, 20);

        var alternativeCount =
            Math.Clamp(request.AlternativeCount, 1, 10);

        var result = new TransitJourneyPlanResult
        {
            RequestedDepartureDateTime = requestedDepartureDateTime,
            StartLongitude = request.StartLongitude,
            StartLatitude = request.StartLatitude,
            EndLongitude = request.EndLongitude,
            EndLatitude = request.EndLatitude
        };

        var alternatives =
            new List<TransitJourneyAlternative>();

        // 1) A -> B gerçek yaya alternatifi.
        try
        {
            var directWalk =
                await _walkingRouteService.CreateWalkingRouteAsync(
                    request.StartLongitude,
                    request.StartLatitude,
                    request.EndLongitude,
                    request.EndLatitude,
                    cancellationToken
                );

            var directWalkWkt =
                new WKTWriter().Write(directWalk.Geometry);

            alternatives.Add(
                new TransitJourneyAlternative
                {
                    RouteId = 0,
                    RouteName = "Yürüme",
                    RouteShortCode = "YÜRÜ",
                    RouteColor = "#0f766e",
                    VehicleType = "Walk",
                    TripId = 0,
                    TripCode = "",
                    RequestedDepartureDateTime =
                        requestedDepartureDateTime,
                    BoardingDateTime =
                        requestedDepartureDateTime,
                    AlightingDateTime =
                        requestedDepartureDateTime
                            .AddSeconds(directWalk.DurationSeconds),
                    InitialWalkingMeters =
                        Math.Round(directWalk.DistanceMeters, 1),
                    FinalWalkingMeters = 0,
                    TotalWalkingMeters =
                        Math.Round(directWalk.DistanceMeters, 1),
                    WalkingDurationSeconds =
                        Math.Round(directWalk.DurationSeconds, 1),
                    WaitingDurationSeconds = 0,
                    InVehicleDurationSeconds = 0,
                    TotalDurationSeconds =
                        Math.Round(directWalk.DurationSeconds, 1),
                    Score = directWalk.DurationSeconds,
                    RouteWkt = directWalkWkt,
                    Steps =
                    [
                        new TransitJourneyStep
                        {
                            Type = "Walk",
                            Description =
                                "Başlangıç POI'sinden hedef POI'ye yürü.",
                            DistanceMeters =
                                Math.Round(directWalk.DistanceMeters, 1),
                            DurationSeconds =
                                Math.Round(directWalk.DurationSeconds, 1),
                            FromLongitude = request.StartLongitude,
                            FromLatitude = request.StartLatitude,
                            ToLongitude = request.EndLongitude,
                            ToLatitude = request.EndLatitude,
                            GeometryWkt = directWalkWkt
                        }
                    ]
                }
            );
        }
        catch (Exception ex)
        {
            Console.WriteLine(
                $"[TRANSIT][DIRECT WALK ERROR] {ex}"
            );
        }

        var activeStops = await _context.TransitStops
            .AsNoTracking()
            .Where(stop =>
                stop.IsActive &&
                !stop.IsDeleted &&
                stop.Geometry != null &&
                stop.TransitRoute != null &&
                stop.TransitRoute.IsActive &&
                !stop.TransitRoute.IsDeleted
            )
            .Include(stop => stop.TransitRoute)
            .ToListAsync(cancellationToken);

        // Önce düz kuş uçuşu ile ucuz bir shortlist.
        // Sonra GERÇEK yaya ağı ile doğrula.
        var startShortList = activeStops
            .Select(stop => new
            {
                Stop = stop,
                AirDistance = CalculateHaversineMeters(
                    request.StartLongitude,
                    request.StartLatitude,
                    stop.Geometry.X,
                    stop.Geometry.Y
                )
            })
            .Where(x =>
                x.AirDistance <= maximumWalkingDistanceMeters * 1.6
            )
            .OrderBy(x => x.AirDistance)
            .Take(Math.Max(candidateStopCount * 2, 10))
            .Select(x => x.Stop)
            .ToList();

        var endShortList = activeStops
            .Select(stop => new
            {
                Stop = stop,
                AirDistance = CalculateHaversineMeters(
                    stop.Geometry.X,
                    stop.Geometry.Y,
                    request.EndLongitude,
                    request.EndLatitude
                )
            })
            .Where(x =>
                x.AirDistance <= maximumWalkingDistanceMeters * 1.6
            )
            .OrderBy(x => x.AirDistance)
            .Take(Math.Max(candidateStopCount * 2, 10))
            .Select(x => x.Stop)
            .ToList();

        var startCandidates =
            await BuildWalkingCandidatesAsync(
                startShortList,
                request.StartLongitude,
                request.StartLatitude,
                fromPointToStop: true,
                maximumWalkingDistanceMeters,
                candidateStopCount,
                cancellationToken
            );

        var endCandidates =
            await BuildWalkingCandidatesAsync(
                endShortList,
                request.EndLongitude,
                request.EndLatitude,
                fromPointToStop: false,
                maximumWalkingDistanceMeters,
                candidateStopCount,
                cancellationToken
            );

        if (
            startCandidates.Count == 0 ||
            endCandidates.Count == 0
        )
        {
            result.Alternatives = alternatives
                .OrderBy(x => x.TotalDurationSeconds)
                .ToList();

            return result;
        }

        var startCandidateByStopId =
            startCandidates.ToDictionary(x => x.Stop.Id);

        var endCandidateByStopId =
            endCandidates.ToDictionary(x => x.Stop.Id);

        var candidateStopIds =
            startCandidateByStopId.Keys
                .Concat(endCandidateByStopId.Keys)
                .Distinct()
                .ToList();

        var trips = await _context.TransitTrips
            .AsNoTracking()
            .Where(trip =>
                trip.IsActive &&
                !trip.IsDeleted &&
                trip.TransitRoute != null &&
                trip.TransitRoute.IsActive &&
                !trip.TransitRoute.IsDeleted &&
                trip.TransitSchedule != null &&
                trip.TransitSchedule.IsActive &&
                !trip.TransitSchedule.IsDeleted &&
                trip.Stops.Any(stop =>
                    candidateStopIds.Contains(
                        stop.TransitStopId
                    )
                )
            )
            .Include(trip => trip.TransitRoute)
            .Include(trip => trip.TransitSchedule)
            .Include(trip => trip.Stops)
                .ThenInclude(stop => stop.TransitStop)
            .ToListAsync(cancellationToken);

        foreach (var trip in trips)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var schedule = trip.TransitSchedule;
            var route = trip.TransitRoute;

            if (schedule == null || route == null)
            {
                continue;
            }

            var orderedTripStops = trip.Stops
                .Where(item =>
                    item.TransitStop != null &&
                    item.TransitStop.IsActive &&
                    !item.TransitStop.IsDeleted &&
                    item.TransitStop.Geometry != null
                )
                .OrderBy(item => item.StopSequence)
                .ToList();

            var possibleBoardingStops =
                orderedTripStops
                    .Where(item =>
                        startCandidateByStopId.ContainsKey(
                            item.TransitStopId
                        )
                    )
                    .ToList();

            var possibleAlightingStops =
                orderedTripStops
                    .Where(item =>
                        endCandidateByStopId.ContainsKey(
                            item.TransitStopId
                        )
                    )
                    .ToList();

            foreach (
                var boardingTripStop
                in possibleBoardingStops
            )
            {
                var boardingStop =
                    boardingTripStop.TransitStop!;

                var startCandidate =
                    startCandidateByStopId[
                        boardingStop.Id
                    ];

                var arrivalAtBoardingStop =
                    requestedDepartureDateTime
                        .AddSeconds(
                            startCandidate.DurationSeconds
                        );

                var tripDepartureDateTime =
                    FindNextTripDepartureDateTime(
                        schedule,
                        trip.DepartureTime,
                        boardingTripStop
                            .DepartureOffsetSeconds,
                        arrivalAtBoardingStop
                    );

                if (!tripDepartureDateTime.HasValue)
                {
                    continue;
                }

                var boardingDateTime =
                    tripDepartureDateTime.Value
                        .AddSeconds(
                            boardingTripStop
                                .DepartureOffsetSeconds
                        );

                foreach (
                    var alightingTripStop
                    in possibleAlightingStops
                )
                {
                    if (
                        alightingTripStop.StopSequence <=
                        boardingTripStop.StopSequence
                    )
                    {
                        continue;
                    }

                    var alightingStop =
                        alightingTripStop.TransitStop!;

                    var endCandidate =
                        endCandidateByStopId[
                            alightingStop.Id
                        ];

                    var alightingDateTime =
                        tripDepartureDateTime.Value
                            .AddSeconds(
                                alightingTripStop
                                    .ArrivalOffsetSeconds
                            );

                    var waitingSeconds =
                        Math.Max(
                            0,
                            (boardingDateTime -
                             arrivalAtBoardingStop)
                                .TotalSeconds
                        );

                    var inVehicleSeconds =
                        Math.Max(
                            0,
                            alightingTripStop
                                .ArrivalOffsetSeconds -
                            boardingTripStop
                                .DepartureOffsetSeconds
                        );

                    if (inVehicleSeconds <= 0)
                    {
                        continue;
                    }

                    var totalWalkingMeters =
                        startCandidate.DistanceMeters +
                        endCandidate.DistanceMeters;

                    var totalWalkingSeconds =
                        startCandidate.DurationSeconds +
                        endCandidate.DurationSeconds;

                    var totalDurationSeconds =
                        totalWalkingSeconds +
                        waitingSeconds +
                        inVehicleSeconds;

                    var score =
                        totalDurationSeconds +
                        totalWalkingSeconds * 0.25 +
                        waitingSeconds * 0.10;

                    alternatives.Add(
                        new TransitJourneyAlternative
                        {
                            RouteId = route.Id,
                            RouteName = route.Name,
                            RouteShortCode =
                                route.ShortCode,
                            RouteColor = route.Color,
                            VehicleType =
                                NormalizeVehicleType(
                                    trip.VehicleType
                                ),
                            TripId = trip.Id,
                            TripCode = trip.TripCode,

                            BoardingStopId =
                                boardingStop.Id,
                            BoardingStopName =
                                boardingStop.Name,
                            BoardingStopSequence =
                                boardingTripStop
                                    .StopSequence,

                            AlightingStopId =
                                alightingStop.Id,
                            AlightingStopName =
                                alightingStop.Name,
                            AlightingStopSequence =
                                alightingTripStop
                                    .StopSequence,

                            RequestedDepartureDateTime =
                                requestedDepartureDateTime,
                            BoardingDateTime =
                                boardingDateTime,
                            AlightingDateTime =
                                alightingDateTime,

                            InitialWalkingMeters =
                                Math.Round(
                                    startCandidate
                                        .DistanceMeters,
                                    1
                                ),
                            FinalWalkingMeters =
                                Math.Round(
                                    endCandidate
                                        .DistanceMeters,
                                    1
                                ),
                            TotalWalkingMeters =
                                Math.Round(
                                    totalWalkingMeters,
                                    1
                                ),
                            WalkingDurationSeconds =
                                Math.Round(
                                    totalWalkingSeconds,
                                    1
                                ),
                            WaitingDurationSeconds =
                                Math.Round(
                                    waitingSeconds,
                                    1
                                ),
                           InVehicleDurationSeconds = inVehicleSeconds,
                            TotalDurationSeconds =
                                Math.Round(
                                    totalDurationSeconds,
                                    1
                                ),
                            Score =
                                Math.Round(score, 2),
                            RouteWkt =
                                route.RouteWkt ?? "",
                            Steps = BuildSteps(
                                request,
                                boardingStop,
                                alightingStop,
                                route,
                                trip,
                                startCandidate,
                                endCandidate,
                                inVehicleSeconds
                            )
                        }
                    );
                }
            }
        }

        // Sonuçları ulaşım türüne göre BAĞIMSIZ değerlendir.
        // Böylece çok sayıda otobüs sonucu metro sonuçlarını,
        // metro sonuçları da otobüs sonuçlarını listeden düşürmez.
        var walking =
            alternatives
                .Where(x =>
                    string.Equals(
                        x.VehicleType,
                        "Walk",
                        StringComparison.OrdinalIgnoreCase
                    )
                )
                .OrderBy(x =>
                    x.TotalDurationSeconds
                )
                .Take(1)
                .ToList();

        var busAlternatives =
            alternatives
                .Where(x =>
                    string.Equals(
                        x.VehicleType,
                        "Bus",
                        StringComparison.OrdinalIgnoreCase
                    )
                )
                .GroupBy(x => new
                {
                    x.TripId,
                    x.BoardingStopId,
                    x.AlightingStopId
                })
                .Select(group =>
                    group
                        .OrderBy(x => x.Score)
                        .ThenBy(x =>
                            x.TotalDurationSeconds
                        )
                        .First()
                )
                .OrderBy(x => x.Score)
                .ThenBy(x =>
                    x.TotalDurationSeconds
                )
                .Take(alternativeCount)
                .ToList();

        var metroAlternatives =
            alternatives
                .Where(x =>
                    string.Equals(
                        x.VehicleType,
                        "Metro",
                        StringComparison.OrdinalIgnoreCase
                    )
                )
                .GroupBy(x => new
                {
                    x.TripId,
                    x.BoardingStopId,
                    x.AlightingStopId
                })
                .Select(group =>
                    group
                        .OrderBy(x => x.Score)
                        .ThenBy(x =>
                            x.TotalDurationSeconds
                        )
                        .First()
                )
                .OrderBy(x => x.Score)
                .ThenBy(x =>
                    x.TotalDurationSeconds
                )
                .Take(alternativeCount)
                .ToList();

        result.Alternatives =
            walking
                .Concat(busAlternatives)
                .Concat(metroAlternatives)
                .ToList();

        return result;
    }

    private async Task<List<StopCandidate>>
        BuildWalkingCandidatesAsync(
            List<TransitStop> stops,
            double pointLongitude,
            double pointLatitude,
            bool fromPointToStop,
            double maximumWalkingDistanceMeters,
            int candidateStopCount,
            CancellationToken cancellationToken
        )
    {
        var result =
            new List<StopCandidate>();

        foreach (var stop in stops)
        {
            cancellationToken
                .ThrowIfCancellationRequested();

            try
            {
                WalkingRouteResult walk;

                if (fromPointToStop)
                {
                    walk =
                        await _walkingRouteService
                            .CreateWalkingRouteAsync(
                                pointLongitude,
                                pointLatitude,
                                stop.Geometry.X,
                                stop.Geometry.Y,
                                cancellationToken
                            );
                }
                else
                {
                    walk =
                        await _walkingRouteService
                            .CreateWalkingRouteAsync(
                                stop.Geometry.X,
                                stop.Geometry.Y,
                                pointLongitude,
                                pointLatitude,
                                cancellationToken
                            );
                }

                if (
                    walk.DistanceMeters >
                    maximumWalkingDistanceMeters
                )
                {
                    continue;
                }

                result.Add(
                    new StopCandidate
                    {
                        Stop = stop,
                        DistanceMeters =
                            walk.DistanceMeters,
                        DurationSeconds =
                            walk.DurationSeconds,
                        GeometryWkt =
                            new WKTWriter()
                                .Write(walk.Geometry)
                    }
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"[TRANSIT][STOP WALK ERROR] Stop={stop.Name} Error={ex.Message}"
                );
            }
        }

        return result
            .OrderBy(x => x.DurationSeconds)
            .ThenBy(x => x.DistanceMeters)
            .Take(candidateStopCount)
            .ToList();
    }

    private static List<TransitJourneyStep>
        BuildSteps(
            TransitJourneyPlanRequest request,
            TransitStop boardingStop,
            TransitStop alightingStop,
            TransitRoute route,
            TransitTrip trip,
            StopCandidate startCandidate,
            StopCandidate endCandidate,
            double inVehicleSeconds
        )
    {
        return
        [
            new TransitJourneyStep
            {
                Type = "Walk",
                Description =
                    $"{boardingStop.Name} durağına yürü.",
                DistanceMeters =
                    Math.Round(
                        startCandidate.DistanceMeters,
                        1
                    ),
                DurationSeconds =
                    Math.Round(
                        startCandidate.DurationSeconds,
                        1
                    ),
                FromLongitude =
                    request.StartLongitude,
                FromLatitude =
                    request.StartLatitude,
                ToLongitude =
                    boardingStop.Geometry.X,
                ToLatitude =
                    boardingStop.Geometry.Y,
                GeometryWkt =
                    startCandidate.GeometryWkt
            },

            new TransitJourneyStep
            {
                Type = "Transit",
                Description =
                    $"{route.ShortCode} {route.Name} hattına " +
                    $"{boardingStop.Name} durağından bin; " +
                    $"{alightingStop.Name} durağında in.",
                DistanceMeters = 0,
                DurationSeconds =
                    Math.Round(
                        inVehicleSeconds,
                        1
                    ),
                FromLongitude =
                    boardingStop.Geometry.X,
                FromLatitude =
                    boardingStop.Geometry.Y,
                ToLongitude =
                    alightingStop.Geometry.X,
                ToLatitude =
                    alightingStop.Geometry.Y,
                GeometryWkt =
                    route.RouteWkt ?? ""
            },

            new TransitJourneyStep
            {
                Type = "GetOff",
                Description =
                    $"{alightingStop.Name} durağında " +
                    $"{NormalizeVehicleType(trip.VehicleType)} aracından in.",
                FromLongitude =
                    alightingStop.Geometry.X,
                FromLatitude =
                    alightingStop.Geometry.Y,
                ToLongitude =
                    alightingStop.Geometry.X,
                ToLatitude =
                    alightingStop.Geometry.Y
            },

            new TransitJourneyStep
            {
                Type = "Walk",
                Description =
                    $"{alightingStop.Name} durağından hedefe yürü.",
                DistanceMeters =
                    Math.Round(
                        endCandidate.DistanceMeters,
                        1
                    ),
                DurationSeconds =
                    Math.Round(
                        endCandidate.DurationSeconds,
                        1
                    ),
                FromLongitude =
                    alightingStop.Geometry.X,
                FromLatitude =
                    alightingStop.Geometry.Y,
                ToLongitude =
                    request.EndLongitude,
                ToLatitude =
                    request.EndLatitude,
                GeometryWkt =
                    endCandidate.GeometryWkt
            }
        ];
    }

    private DateTime? FindNextTripDepartureDateTime(
        TransitSchedule schedule,
        TimeOnly tripDepartureTime,
        int boardingDepartureOffsetSeconds,
        DateTime earliestBoardingArrivalDateTime
    )
    {
        for (
            var dayOffset = 0;
            dayOffset <= _maximumSearchDays;
            dayOffset++
        )
        {
            var serviceDate =
                earliestBoardingArrivalDateTime
                    .Date
                    .AddDays(dayOffset);

            var serviceDateTime =
                serviceDate.Add(
                    tripDepartureTime
                        .ToTimeSpan()
                );

            if (
                !ScheduleRunsOnDate(
                    schedule,
                    serviceDateTime
                )
            )
            {
                continue;
            }

            var boardingDateTime =
                serviceDateTime.AddSeconds(
                    boardingDepartureOffsetSeconds
                );

            if (
                boardingDateTime >=
                earliestBoardingArrivalDateTime
            )
            {
                return serviceDateTime;
            }
        }

        return null;
    }

    private static string NormalizeVehicleType(
        string? value
    )
    {
        var normalized =
            (value ?? "")
                .Trim()
                .ToLowerInvariant();

        if (
            normalized.Contains("metro") ||
            normalized.Contains("subway")
        )
        {
            return "Metro";
        }

        return "Bus";
    }

    private static bool ScheduleRunsOnDate(
        TransitSchedule schedule,
        DateTime dateTime
    )
    {
        var date = dateTime.Date;

        if (date < schedule.ValidFrom.Date)
        {
            return false;
        }

        if (
            schedule.ValidTo.HasValue &&
            date > schedule.ValidTo.Value.Date
        )
        {
            return false;
        }

        return dateTime.DayOfWeek switch
        {
            DayOfWeek.Monday =>
                schedule.RunsMonday,
            DayOfWeek.Tuesday =>
                schedule.RunsTuesday,
            DayOfWeek.Wednesday =>
                schedule.RunsWednesday,
            DayOfWeek.Thursday =>
                schedule.RunsThursday,
            DayOfWeek.Friday =>
                schedule.RunsFriday,
            DayOfWeek.Saturday =>
                schedule.RunsSaturday,
            DayOfWeek.Sunday =>
                schedule.RunsSunday,
            _ => false
        };
    }

    private static void ValidateRequest(
        TransitJourneyPlanRequest request
    )
    {
        if (
            request.StartLongitude < -180 ||
            request.StartLongitude > 180 ||
            request.EndLongitude < -180 ||
            request.EndLongitude > 180
        )
        {
            throw new InvalidOperationException(
                "Longitude değeri -180 ile 180 arasında olmalıdır."
            );
        }

        if (
            request.StartLatitude < -90 ||
            request.StartLatitude > 90 ||
            request.EndLatitude < -90 ||
            request.EndLatitude > 90
        )
        {
            throw new InvalidOperationException(
                "Latitude değeri -90 ile 90 arasında olmalıdır."
            );
        }
    }

    private static double CalculateHaversineMeters(
        double longitude1,
        double latitude1,
        double longitude2,
        double latitude2
    )
    {
        const double earthRadiusMeters =
            6_371_000.0;

        static double R(double degree) =>
            degree * Math.PI / 180.0;

        var lat1 = R(latitude1);
        var lat2 = R(latitude2);
        var dLat = R(latitude2 - latitude1);
        var dLon =
            R(longitude2 - longitude1);

        var a =
            Math.Sin(dLat / 2) *
            Math.Sin(dLat / 2) +
            Math.Cos(lat1) *
            Math.Cos(lat2) *
            Math.Sin(dLon / 2) *
            Math.Sin(dLon / 2);

        var c =
            2 *
            Math.Atan2(
                Math.Sqrt(a),
                Math.Sqrt(1 - a)
            );

        return earthRadiusMeters * c;
    }

    private sealed class StopCandidate
    {
        public TransitStop Stop { get; set; } =
            null!;

        public double DistanceMeters { get; set; }
        public double DurationSeconds { get; set; }
        public string GeometryWkt { get; set; } = "";
    }
}
