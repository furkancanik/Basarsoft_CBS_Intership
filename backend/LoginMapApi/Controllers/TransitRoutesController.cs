using LoginMapApi.Data;
using LoginMapApi.Models;
using LoginMapApi.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.IO;
using System.Security.Claims;

namespace LoginMapApi.Controllers;

public class CreateTransitRouteRequest
{
    public string Name { get; set; } = "";

    public string ShortCode { get; set; } = "";

    public string Color { get; set; } = "#2563eb";
}

public class UpdateTransitRouteRequest
{
    public string Name { get; set; } = "";

    public string ShortCode { get; set; } = "";

    public string Color { get; set; } = "#2563eb";

    public bool IsActive { get; set; } = true;
}

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class TransitRoutesController : ControllerBase
{
    private readonly AppDbContext _context;

    private readonly ITransitRouteGenerationService
        _routeGenerationService;

    private readonly IVehicleSimulationService
        _vehicleSimulationService;

    public TransitRoutesController(
        AppDbContext context,
        ITransitRouteGenerationService routeGenerationService,
        IVehicleSimulationService vehicleSimulationService
    )
    {
        _context = context;

        _routeGenerationService =
            routeGenerationService;

        _vehicleSimulationService =
            vehicleSimulationService;
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(
            ClaimTypes.NameIdentifier
        )?.Value;

        if (!int.TryParse(claim, out var userId))
        {
            throw new UnauthorizedAccessException(
                "Token içinde kullanıcı ID bulunamadı."
            );
        }

        return userId;
    }

    private static string NormalizeRoleName(
        string? value
    )
    {
        return (value ?? "")
            .Trim()
            .ToLowerInvariant()
            .Replace("ö", "o")
            .Replace("ü", "u")
            .Replace("ş", "s")
            .Replace("ı", "i")
            .Replace("ğ", "g")
            .Replace("ç", "c")
            .Replace(" ", "");
    }

    private static string NormalizeShortCode(
        string? value
    )
    {
        return (value ?? "")
            .Trim()
            .ToUpperInvariant();
    }

    private async Task<bool> UserHasRole(
        params string[] roleNames
    )
    {
        var userId = GetUserId();

        var roles = await _context.UserRoles
            .Where(userRole =>
                userRole.UserId == userId
            )
            .Join(
                _context.Roles,
                userRole => userRole.RoleId,
                role => role.Id,
                (userRole, role) => role
            )
            .Where(role =>
                role.IsActive &&
                !role.IsDeleted
            )
            .Select(role => role.Name)
            .ToListAsync();

        return roles.Any(userRoleName =>
            roleNames.Any(requiredRoleName =>
                NormalizeRoleName(userRoleName) ==
                NormalizeRoleName(requiredRoleName)
            )
        );
    }

    private static object ToSimulationResponse(
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
            DepartureTime = state.DepartureTime.ToString("HH:mm:ss"),
            state.IsAutomatic,

            state.RouteId,
            state.RouteName,
            state.ShortCode,
            state.RouteColor,
            state.VehicleType,
            state.IsRunning,

            Progress = Math.Round(state.Progress, 2),

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

    /*
     * Aktif güzergahları ve bağlı durakları getirir.
     *
     * OSRM ile oluşturulan rota bilgileri de
     * frontend'e gönderilir.
     */
    [HttpGet]
    public async Task<IActionResult> GetRoutes()
    {
        try
        {
            var routes = await _context.TransitRoutes
                .Where(route =>
                    route.IsActive &&
                    !route.IsDeleted
                )
                .Include(route =>
                    route.Stops.Where(stop =>
                        stop.IsActive &&
                        !stop.IsDeleted
                    )
                )
                .Include(route => route.CreatedUser)
                .OrderBy(route => route.Name)
                .ToListAsync();

            var result = routes.Select(route => new
            {
                route.Id,
                route.Name,
                route.ShortCode,
                route.Color,

                route.RouteWkt,
                route.DistanceMeters,
                route.DurationSeconds,
                route.RouteUpdatedDate,

                HasGeneratedRoute =
                    !string.IsNullOrWhiteSpace(
                        route.RouteWkt
                    ),

                route.IsActive,
                route.CreatedDate,
                route.CreatedUserId,
                route.ModifiedDate,

                CreatorUsername =
                    route.CreatedUser != null
                        ? route.CreatedUser.Username
                        : null,

                CreatorProfileImageUrl =
                    route.CreatedUser != null
                        ? route.CreatedUser.ProfileImageUrl
                        : null,

                StopCount = route.Stops.Count,

                Stops = route.Stops
                    .OrderBy(stop => stop.OrderNo)
                    .Select(stop => new
                    {
                        stop.Id,
                        stop.Name,
                        stop.OrderNo,
                        stop.TransitRouteId,
                        stop.StopType,

                        Longitude = stop.Geometry.X,
                        Latitude = stop.Geometry.Y
                    })
            });

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message =
                    "Güzergahlar alınırken hata oluştu.",

                error = ex.Message
            });
        }
    }

    /*
     * Tek bir güzergahı durakları ve
     * oluşturulan OSRM rotasıyla birlikte getirir.
     */
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetRoute(int id)
    {
        try
        {
            var route = await _context.TransitRoutes
                .Where(item =>
                    item.Id == id &&
                    item.IsActive &&
                    !item.IsDeleted
                )
                .Include(item =>
                    item.Stops.Where(stop =>
                        stop.IsActive &&
                        !stop.IsDeleted
                    )
                )
                .Include(item => item.CreatedUser)
                .FirstOrDefaultAsync();

            if (route == null)
            {
                return NotFound(new
                {
                    message = "Güzergah bulunamadı."
                });
            }

            return Ok(new
            {
                route.Id,
                route.Name,
                route.ShortCode,
                route.Color,

                route.RouteWkt,
                route.DistanceMeters,
                route.DurationSeconds,
                route.RouteUpdatedDate,

                HasGeneratedRoute =
                    !string.IsNullOrWhiteSpace(
                        route.RouteWkt
                    ),

                route.IsActive,
                route.CreatedDate,
                route.CreatedUserId,
                route.ModifiedDate,

                CreatorUsername =
                    route.CreatedUser != null
                        ? route.CreatedUser.Username
                        : null,

                CreatorProfileImageUrl =
                    route.CreatedUser != null
                        ? route.CreatedUser.ProfileImageUrl
                        : null,

                StopCount = route.Stops.Count,

                Stops = route.Stops
                    .OrderBy(stop => stop.OrderNo)
                    .Select(stop => new
                    {
                        stop.Id,
                        stop.Name,
                        stop.OrderNo,
                        stop.TransitRouteId,
                        stop.StopType,

                        Longitude = stop.Geometry.X,
                        Latitude = stop.Geometry.Y
                    })
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message =
                    "Güzergah bilgisi alınırken hata oluştu.",

                error = ex.Message
            });
        }
    }

    /*
     * Yeni güzergah oluşturur.
     */
    [HttpPost]
    public async Task<IActionResult> AddRoute(
        [FromBody] CreateTransitRouteRequest request
    )
    {
        try
        {
            var userId = GetUserId();

            var canManage = await UserHasRole(
                "Admin",
                "Operator",
                "Operatör",
                    "Kullanıcı",
                "Ulaşım Operatörü",
                "Ulasim Operatoru"
            );

            if (!canManage)
            {
                return StatusCode(403, new
                {
                    message =
                        "Güzergah ekleme yetkiniz bulunmamaktadır."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new
                {
                    message =
                        "Güzergah adı boş olamaz."
                });
            }

            if (string.IsNullOrWhiteSpace(
                    request.ShortCode
                ))
            {
                return BadRequest(new
                {
                    message =
                        "Güzergah kısa kodu boş olamaz."
                });
            }

            var normalizedShortCode =
                NormalizeShortCode(
                    request.ShortCode
                );

            if (normalizedShortCode.Length > 10)
            {
                return BadRequest(new
                {
                    message =
                        "Güzergah kısa kodu en fazla 10 karakter olabilir."
                });
            }

            if (string.IsNullOrWhiteSpace(
                    request.Color
                ))
            {
                request.Color = "#2563eb";
            }

            var normalizedName =
                request.Name
                    .Trim()
                    .ToLowerInvariant();

            var duplicateRoute =
                await _context.TransitRoutes
                    .AnyAsync(route =>
                        !route.IsDeleted &&
                        (
                            route.Name.ToLower() ==
                                normalizedName ||

                            route.ShortCode.ToUpper() ==
                                normalizedShortCode
                        )
                    );

            if (duplicateRoute)
            {
                return BadRequest(new
                {
                    message =
                        "Bu isimde veya kısa kodda bir güzergah zaten bulunmaktadır."
                });
            }

            var route = new TransitRoute
            {
                Name = request.Name.Trim(),

                ShortCode =
                    normalizedShortCode,

                Color = request.Color.Trim(),

                RouteWkt = null,
                DistanceMeters = null,
                DurationSeconds = null,
                RouteUpdatedDate = null,

                IsActive = true,
                IsDeleted = false,
                CreatedDate = DateTime.UtcNow,
                CreatedUserId = userId
            };

            _context.TransitRoutes.Add(route);

            await _context.SaveChangesAsync();

            var creator = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(user =>
                    user.Id == userId
                );

            return Ok(new
            {
                message =
                    "Güzergah başarıyla eklendi.",

                route.Id,
                route.Name,
                route.ShortCode,
                route.Color,
                route.CreatedUserId,

                CreatorUsername =
                    creator != null
                        ? creator.Username
                        : null,

                CreatorProfileImageUrl =
                    creator != null
                        ? creator.ProfileImageUrl
                        : null
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
            return StatusCode(500, new
            {
                message =
                    "Güzergah eklenirken hata oluştu.",

                error = ex.Message
            });
        }
    }

    /*
     * Seçilen güzergahın duraklarını OrderNo
     * sırasına göre Docker üzerindeki local
     * OSRM servisine gönderir.
     */
    [HttpPost("{id:int}/generate-route")]
    public async Task<IActionResult> GenerateRoute(
        int id,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var userId = GetUserId();

            var canManage = await UserHasRole(
                "Admin",
                "Operator",
                "Operatör",
                    "Kullanıcı",
                "Ulaşım Operatörü",
                "Ulasim Operatoru"
            );

            if (!canManage)
            {
                return StatusCode(403, new
                {
                    message =
                        "Rota oluşturma yetkiniz bulunmamaktadır."
                });
            }

            var activeStopCount =
                await _context.TransitStops.CountAsync(
                    stop =>
                        stop.TransitRouteId == id &&
                        stop.IsActive &&
                        !stop.IsDeleted &&
                        stop.Geometry != null,
                    cancellationToken
                );

            if (activeStopCount < 2)
            {
                return BadRequest(new
                {
                    message =
                        "Rota oluşturmak için güzergaha en az 2 aktif durak eklenmelidir."
                });
            }

            var route =
                await _routeGenerationService
                    .RegenerateRouteAsync(
                        id,
                        userId,
                        cancellationToken
                    );

            var orderedStops =
                await _context.TransitStops
                    .Where(stop =>
                        stop.TransitRouteId == id &&
                        stop.IsActive &&
                        !stop.IsDeleted
                    )
                    .OrderBy(stop => stop.OrderNo)
                    .ThenBy(stop => stop.Id)
                    .ToListAsync(
                        cancellationToken
                    );

            return Ok(new
            {
                message =
                    "Rota local Docker OSRM kullanılarak başarıyla oluşturuldu.",

                route.Id,
                route.Name,
                route.ShortCode,
                route.Color,
                route.RouteWkt,
                route.DistanceMeters,
                route.DurationSeconds,
                route.RouteUpdatedDate,

                StopCount =
                    orderedStops.Count,

                Stops = orderedStops.Select(
                    stop => new
                    {
                        stop.Id,
                        stop.Name,
                        stop.OrderNo,

                        Longitude =
                            stop.Geometry.X,

                        Latitude =
                            stop.Geometry.Y
                    }
                )
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new
            {
                message = ex.Message
            });
        }
        catch (OperationCanceledException)
        {
            return StatusCode(408, new
            {
                message =
                    "Rota oluşturma isteği zaman aşımına uğradı."
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new
            {
                message = ex.Message
            });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(503, new
            {
                message =
                    "Local OSRM servisine bağlanılamadı. Docker container'ın çalıştığını kontrol edin.",

                error = ex.Message
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message =
                    "Rota oluşturulurken hata oluştu.",

                error = ex.Message,

                innerError =
                    ex.InnerException?.Message
            });
        }
    }

    /*
     * Araç simülasyonu artık routeId tabanlı değil,
     * TransitTrip + SimulationId tabanlı çalışır.
     *
     * Yeni araç başlatma/durdurma endpointleri
     * TransitTripSimulationsController içindedir.
     *
     * Bu controller içerisinde güzergah bazında
     * çalışan araçları listeleme endpointi korunur.
     */

    /*
     * Belirli bir güzergah üzerinde çalışan tüm
     * araç simülasyonlarını getirir.
     *
     * GET:
     * /api/TransitRoutes/1/simulations
     */
    [HttpGet("{id:int}/simulations")]
    public async Task<IActionResult> GetRouteSimulations(int id)
    {
        try
        {
            if (!await _context.TransitRoutes
                    .AnyAsync(route => route.Id == id))
            {
                return NotFound(new
                {
                    message = "Güzergah bulunamadı."
                });
            }

            var simulations =
                _vehicleSimulationService
                    .GetRouteSimulations(id)
                    .Select(ToSimulationResponse)
                    .ToList();

            return Ok(simulations);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message =
                    "Güzergah araç simülasyonları alınırken hata oluştu.",

                error = ex.Message
            });
        }
    }

    /*
     * Çalışan bütün araç simülasyonlarını getirir.
     *
     * GET:
     * /api/TransitRoutes/simulations/running
     */
    [HttpGet("simulations/running")]
    public async Task<IActionResult> GetRunningSimulations()
    {
        try
        {
            // Kullanıcı yalnızca kendi güzergahlarındaki araçları görür.
            var ownedRouteIds = (await _context.TransitRoutes
                .Select(route => route.Id)
                .ToListAsync())
                .ToHashSet();

            var simulations =
                _vehicleSimulationService
                    .GetRunningSimulations()
                    .Where(state =>
                        ownedRouteIds.Contains(state.RouteId)
                    )
                    .Select(ToSimulationResponse)
                    .ToList();

            return Ok(simulations);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message =
                    "Çalışan araç simülasyonları alınırken hata oluştu.",

                error = ex.Message
            });
        }
    }

    /*
     * Güzergah bilgilerini günceller.
     */
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateRoute(
        int id,
        [FromBody] UpdateTransitRouteRequest request
    )
    {
        try
        {
            var userId = GetUserId();

            var canManage = await UserHasRole(
                "Admin",
                "Operator",
                "Operatör",
                    "Kullanıcı",
                "Ulaşım Operatörü",
                "Ulasim Operatoru"
            );

            if (!canManage)
            {
                return StatusCode(403, new
                {
                    message =
                        "Güzergah güncelleme yetkiniz bulunmamaktadır."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new
                {
                    message =
                        "Güzergah adı boş olamaz."
                });
            }

            if (string.IsNullOrWhiteSpace(
                    request.ShortCode
                ))
            {
                return BadRequest(new
                {
                    message =
                        "Güzergah kısa kodu boş olamaz."
                });
            }

            var normalizedShortCode =
                NormalizeShortCode(
                    request.ShortCode
                );

            if (normalizedShortCode.Length > 10)
            {
                return BadRequest(new
                {
                    message =
                        "Güzergah kısa kodu en fazla 10 karakter olabilir."
                });
            }

            var route =
                await _context.TransitRoutes
                    .FirstOrDefaultAsync(item =>
                        item.Id == id &&
                        !item.IsDeleted
                    );

            if (route == null)
            {
                return NotFound(new
                {
                    message =
                        "Güzergah bulunamadı."
                });
            }

            var normalizedName =
                request.Name
                    .Trim()
                    .ToLowerInvariant();

            var duplicateRoute =
                await _context.TransitRoutes
                    .AnyAsync(item =>
                        item.Id != id &&
                        !item.IsDeleted &&
                        (
                            item.Name.ToLower() ==
                                normalizedName ||

                            item.ShortCode.ToUpper() ==
                                normalizedShortCode
                        )
                    );

            if (duplicateRoute)
            {
                return BadRequest(new
                {
                    message =
                        "Bu isimde veya kısa kodda başka bir güzergah bulunmaktadır."
                });
            }

            route.Name =
                request.Name.Trim();

            route.ShortCode =
                normalizedShortCode;

            route.Color =
                string.IsNullOrWhiteSpace(
                    request.Color
                )
                    ? "#2563eb"
                    : request.Color.Trim();

            route.IsActive =
                request.IsActive;

            route.ModifiedDate =
                DateTime.UtcNow;

            route.ModifiedUserId =
                userId;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "Güzergah başarıyla güncellendi.",

                route.Id,
                route.Name,
                route.ShortCode,
                route.Color,
                route.IsActive,

                route.RouteWkt,
                route.DistanceMeters,
                route.DurationSeconds,
                route.RouteUpdatedDate
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
            return StatusCode(500, new
            {
                message =
                    "Güzergah güncellenirken hata oluştu.",

                error = ex.Message
            });
        }
    }

    /*
     * Güzergahı ve bağlı duraklarını soft delete yapar.
     */
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteRoute(int id)
    {
        try
        {
            var userId = GetUserId();

            var isAdmin =
                await UserHasRole(
                    "Admin",
                    "Operator",
                    "Operatör",
                    "Kullanıcı"
                );

            if (!isAdmin)
            {
                return StatusCode(403, new
                {
                    message =
                        "Güzergah silme yetkiniz bulunmamaktadır."
                });
            }

            var route = await _context.TransitRoutes
                .Include(item => item.Stops)
                .FirstOrDefaultAsync(item =>
                    item.Id == id &&
                    !item.IsDeleted
                );

            if (route == null)
            {
                return NotFound(new
                {
                    message =
                        "Güzergah bulunamadı."
                });
            }

            /*
             * Güzergah silinmeden önce çalışan
             * simülasyon varsa durdurulur.
             */
            await _vehicleSimulationService
                .StopRouteSimulationsAsync(id);

            route.IsDeleted = true;
            route.IsActive = false;

            route.ModifiedDate =
                DateTime.UtcNow;

            route.ModifiedUserId =
                userId;

            foreach (
                var stop in route.Stops.Where(
                    stop => !stop.IsDeleted
                )
            )
            {
                stop.IsDeleted = true;
                stop.IsActive = false;

                stop.ModifiedDate =
                    DateTime.UtcNow;

                stop.ModifiedUserId =
                    userId;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "Güzergah ve bağlı durakları başarıyla silindi.",

                route.Id,
                route.Name,
                route.ShortCode
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
            return StatusCode(500, new
            {
                message =
                    "Güzergah silinirken hata oluştu.",

                error = ex.Message
            });
        }
    }
}