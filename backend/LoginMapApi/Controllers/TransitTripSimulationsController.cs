using System.Security.Claims;
using LoginMapApi.Data;
using LoginMapApi.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LoginMapApi.Controllers;

public class StartTripSimulationRequest
{
    public string? VehicleCode { get; set; }
}

[Authorize]
[ApiController]
[Route("api/transit-trip-simulations")]
public class TransitTripSimulationsController : ControllerBase
{
    private readonly IVehicleSimulationService
        _vehicleSimulationService;

    private readonly AppDbContext _context;

    public TransitTripSimulationsController(
        IVehicleSimulationService vehicleSimulationService,
        AppDbContext context
    )
    {
        _vehicleSimulationService =
            vehicleSimulationService;

        _context = context;
    }

    /*
     * Kullanıcının kendi güzergahları. AppDbContext'teki kullanıcı
     * filtresi sayesinde yalnızca giriş yapan kullanıcının
     * güzergahları döner.
     */
    private async Task<HashSet<int>> GetOwnedRouteIdsAsync()
    {
        return (await _context.TransitRoutes
            .Select(route => route.Id)
            .ToListAsync())
            .ToHashSet();
    }

    private Task<bool> UserOwnsTripAsync(int tripId)
    {
        return _context.TransitTrips
            .AnyAsync(trip => trip.Id == tripId);
    }

    private int GetUserId()
    {
        var claim = User
            .FindFirst(
                ClaimTypes.NameIdentifier
            )
            ?.Value;

        if (!int.TryParse(
                claim,
                out var userId
            ))
        {
            throw new UnauthorizedAccessException(
                "Token içinde kullanıcı ID bulunamadı."
            );
        }

        return userId;
    }

    private static object ToResponse(
        LoginMapApi.Models.VehicleSimulationState state
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
                state.DepartureTime
                    .ToString("HH:mm:ss"),

            state.IsAutomatic,

            state.RouteId,
            state.RouteName,
            state.ShortCode,
            state.RouteColor,

            state.VehicleType,

            state.IsRunning,

            state.Progress,

            state.Longitude,
            state.Latitude,

            state.CurrentSpeedKmh,
            state.MaxSpeedKmh,

            state.TravelledDistanceMeters,
            state.RouteLengthMeters,

            state.PreviousStopId,
            state.PreviousStopName,

            state.NextStopId,
            state.NextStopName,

            state.DistanceToNextStopMeters,
            state.EstimatedArrivalSeconds,

            state.IsWaitingAtStop,

            state.WaitingStopId,
            state.WaitingStopName,

            state.CurrentStopWaitSeconds,
            state.StopDwellDurationSeconds,
            state.RemainingStopWaitSeconds,

            state.Status,

            state.StartedByUserId,
            state.StartedDate,
            state.LastUpdatedDate
        };
    }

    /*
     * Seçilen TransitTrip için yeni bir araç başlatır.
     *
     * Aynı trip için tekrar çağrılabilir.
     * Her çağrıda farklı SimulationId oluşur.
     */
    [HttpPost("trips/{tripId:int}/start")]
    public async Task<IActionResult>
        StartTripSimulation(
            int tripId,
            [FromBody]
            StartTripSimulationRequest? request,
            CancellationToken cancellationToken
        )
    {
        try
        {
            if (tripId <= 0)
            {
                return BadRequest(new
                {
                    message =
                        "Geçerli bir sefer seçilmelidir."
                });
            }

            var userId = GetUserId();

            if (!await UserOwnsTripAsync(tripId))
            {
                return NotFound(new
                {
                    message = "Sefer bulunamadı."
                });
            }

            var simulation =
                await _vehicleSimulationService
                    .StartTripAsync(
                        tripId,
                        userId,
                        false,
                        request?.VehicleCode,
                        cancellationToken
                    );

            return Ok(new
            {
                message =
                    "Araç simülasyonu başarıyla başlatıldı.",

                simulation =
                    ToResponse(simulation)
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new
            {
                message = ex.Message
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new
            {
                message = ex.Message
            });
        }
        catch (Exception ex)
        {
            return StatusCode(
                500,
                new
                {
                    message =
                        "Araç simülasyonu başlatılırken hata oluştu.",

                    error = ex.Message
                }
            );
        }
    }

    /*
     * Tek bir aracı SimulationId üzerinden durdurur.
     */
    [HttpPost(
        "simulations/{simulationId:guid}/stop"
    )]
    public async Task<IActionResult>
        StopSimulation(
            Guid simulationId,
            CancellationToken cancellationToken
        )
    {
        try
        {
            var state =
                _vehicleSimulationService
                    .GetState(simulationId);

            if (state == null ||
                !(await GetOwnedRouteIdsAsync())
                    .Contains(state.RouteId))
            {
                return NotFound(new
                {
                    message =
                        "Çalışan araç simülasyonu bulunamadı."
                });
            }

            var stopped =
                await _vehicleSimulationService
                    .StopSimulationAsync(
                        simulationId,
                        cancellationToken
                    );

            if (!stopped)
            {
                return NotFound(new
                {
                    message =
                        "Çalışan araç simülasyonu bulunamadı."
                });
            }

            return Ok(new
            {
                message =
                    "Araç simülasyonu durduruldu.",

                simulationId
            });
        }
        catch (Exception ex)
        {
            return StatusCode(
                500,
                new
                {
                    message =
                        "Araç simülasyonu durdurulurken hata oluştu.",

                    error = ex.Message
                }
            );
        }
    }

    /*
     * Bir sefer üzerindeki bütün araçları durdurur.
     */
    [HttpPost(
        "trips/{tripId:int}/stop-all"
    )]
    public async Task<IActionResult>
        StopTripSimulations(
            int tripId,
            CancellationToken cancellationToken
        )
    {
        try
        {
            if (!await UserOwnsTripAsync(tripId))
            {
                return NotFound(new
                {
                    message = "Sefer bulunamadı."
                });
            }

            var stoppedCount =
                await _vehicleSimulationService
                    .StopTripSimulationsAsync(
                        tripId,
                        cancellationToken
                    );

            return Ok(new
            {
                message =
                    $"{stoppedCount} araç simülasyonu durduruldu.",

                tripId,
                stoppedCount
            });
        }
        catch (Exception ex)
        {
            return StatusCode(
                500,
                new
                {
                    message =
                        "Sefer simülasyonları durdurulurken hata oluştu.",

                    error = ex.Message
                }
            );
        }
    }

    /*
     * Bir güzergah üzerindeki bütün araçları durdurur.
     *
     * TransitRoutesPanel içerisindeki
     * "Tüm Araçları Durdur" butonu bunu çağırır.
     */
    [HttpPost(
        "routes/{routeId:int}/stop-all"
    )]
    public async Task<IActionResult>
        StopRouteSimulations(
            int routeId,
            CancellationToken cancellationToken
        )
    {
        try
        {
            if (!(await GetOwnedRouteIdsAsync())
                    .Contains(routeId))
            {
                return NotFound(new
                {
                    message = "Güzergah bulunamadı."
                });
            }

            var stoppedCount =
                await _vehicleSimulationService
                    .StopRouteSimulationsAsync(
                        routeId,
                        cancellationToken
                    );

            return Ok(new
            {
                message =
                    $"{stoppedCount} araç simülasyonu durduruldu.",

                routeId,
                stoppedCount
            });
        }
        catch (Exception ex)
        {
            return StatusCode(
                500,
                new
                {
                    message =
                        "Güzergah simülasyonları durdurulurken hata oluştu.",

                    error = ex.Message
                }
            );
        }
    }

    /*
     * SimulationId ile tek araç bilgisi.
     */
    [HttpGet(
        "simulations/{simulationId:guid}"
    )]
    public async Task<IActionResult> GetSimulation(
        Guid simulationId
    )
    {
        var simulation =
            _vehicleSimulationService
                .GetState(
                    simulationId
                );

        if (simulation == null ||
            !(await GetOwnedRouteIdsAsync())
                .Contains(simulation.RouteId))
        {
            return NotFound(new
            {
                message =
                    "Araç simülasyonu bulunamadı."
            });
        }

        return Ok(
            ToResponse(simulation)
        );
    }

    /*
     * Belirli bir seferde çalışan bütün araçlar.
     */
    [HttpGet("trips/{tripId:int}")]
    public async Task<IActionResult> GetTripSimulations(
        int tripId
    )
    {
        var ownedRouteIds = await GetOwnedRouteIdsAsync();

        var simulations =
            _vehicleSimulationService
                .GetTripSimulations(
                    tripId
                )
                .Where(state =>
                    ownedRouteIds.Contains(state.RouteId)
                )
                .Select(ToResponse)
                .ToList();

        return Ok(simulations);
    }

    /*
     * Belirli bir hatta çalışan bütün araçlar.
     */
    [HttpGet("routes/{routeId:int}")]
    public async Task<IActionResult> GetRouteSimulations(
        int routeId
    )
    {
        var ownedRouteIds = await GetOwnedRouteIdsAsync();

        if (!ownedRouteIds.Contains(routeId))
        {
            return Ok(new List<object>());
        }

        var simulations =
            _vehicleSimulationService
                .GetRouteSimulations(
                    routeId
                )
                .Select(ToResponse)
                .ToList();

        return Ok(simulations);
    }

    /*
     * Kullanıcının kendi güzergahlarında çalışan bütün araçlar.
     */
    [HttpGet("running")]
    public async Task<IActionResult>
        GetRunningSimulations()
    {
        var ownedRouteIds = await GetOwnedRouteIdsAsync();

        var simulations =
            _vehicleSimulationService
                .GetRunningSimulations()
                .Where(state =>
                    ownedRouteIds.Contains(state.RouteId)
                )
                .Select(ToResponse)
                .ToList();

        return Ok(simulations);
    }
}
