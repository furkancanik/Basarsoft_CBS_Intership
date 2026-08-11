using LoginMapApi.Data;
using LoginMapApi.Models;
using LoginMapApi.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.IO;
using System.Security.Claims;

namespace LoginMapApi.Controllers;

public class CreateTransitStopRequest
{
    public string Name { get; set; } = "";

    public int TransitRouteId { get; set; }

    public string Wkt { get; set; } = "";

    public string StopType { get; set; } = "Bus";
}

public class UpdateTransitStopRequest
{
    public string Name { get; set; } = "";

    public int TransitRouteId { get; set; }

    public string Wkt { get; set; } = "";

    public string StopType { get; set; } = "Bus";

    public bool IsActive { get; set; } = true;
}

public class TransitStopOrderItem
{
    public int StopId { get; set; }

    public int OrderNo { get; set; }
}

public class ReorderTransitStopsRequest
{
    public int TransitRouteId { get; set; }

    public List<TransitStopOrderItem> Stops { get; set; } = new();
}

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class TransitStopsController : ControllerBase
{
    private readonly AppDbContext _context;

    private readonly ITransitRouteGenerationService
        _routeGenerationService;

    public TransitStopsController(
        AppDbContext context,
        ITransitRouteGenerationService routeGenerationService
    )
    {
        _context = context;
        _routeGenerationService =
            routeGenerationService;
    }

    private async Task<object> TryRegenerateRouteAsync(
        int routeId,
        int userId,
        bool reorderByCurrentGeometry,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            if (reorderByCurrentGeometry)
            {
                await _routeGenerationService
                    .ReorderStopsByCurrentRouteGeometryAsync(
                        routeId,
                        userId,
                        cancellationToken
                    );
            }

            var route = await _routeGenerationService
                .RegenerateRouteAsync(
                    routeId,
                    userId,
                    cancellationToken
                );

            return new
            {
                success = true,
                routeId,
                routeUpdatedDate =
                    route.RouteUpdatedDate,
                distanceMeters =
                    route.DistanceMeters,
                durationSeconds =
                    route.DurationSeconds
            };
        }
        catch (Exception ex)
        {
            /*
             * Durak kaydı başarılıysa sadece OSRM hatası yüzünden
             * bütün HTTP isteğini başarısız göstermiyoruz.
             * Frontend routeUpdate.success değerinden uyarı gösterebilir.
             */
            return new
            {
                success = false,
                routeId,
                warning =
                    "Durak kaydedildi ancak güzergah otomatik güncellenemedi.",
                error = ex.Message
            };
        }
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!int.TryParse(claim, out var userId))
        {
            throw new UnauthorizedAccessException(
                "Token içinde kullanıcı ID bulunamadı."
            );
        }

        return userId;
    }

    private static string NormalizeRoleName(string? value)
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

    private static string NormalizeStopType(string? stopType)
    {
        var normalizedValue = (stopType ?? "")
            .Trim()
            .ToLowerInvariant();

        return normalizedValue switch
        {
            "metro" => "Metro",
            "bus" => "Bus",
            "otobus" => "Bus",
            "otobüs" => "Bus",
            _ => ""
        };
    }

    private async Task<bool> UserHasRole(params string[] roleNames)
    {
        var userId = GetUserId();

        var roles = await _context.UserRoles
            .Where(userRole => userRole.UserId == userId)
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

    [HttpGet]
    public async Task<IActionResult> GetStops(
        [FromQuery] int? transitRouteId,
        [FromQuery] string? stopType
    )
    {
        try
        {
            var writer = new WKTWriter();

            var query = _context.TransitStops
                .Where(stop =>
                    stop.IsActive &&
                    !stop.IsDeleted
                )
                .Include(stop => stop.TransitRoute)
                .Include(stop => stop.User)
                .AsQueryable();

            if (transitRouteId.HasValue)
            {
                query = query.Where(stop =>
                    stop.TransitRouteId == transitRouteId.Value
                );
            }

            if (!string.IsNullOrWhiteSpace(stopType))
            {
                var normalizedStopType = NormalizeStopType(stopType);

                if (string.IsNullOrWhiteSpace(normalizedStopType))
                {
                    return BadRequest(new
                    {
                        message =
                            "Geçersiz durak tipi. Bus veya Metro kullanılmalıdır."
                    });
                }

                query = query.Where(stop =>
                    stop.StopType == normalizedStopType
                );
            }

            var stops = await query
                .OrderBy(stop => stop.TransitRouteId)
                .ThenBy(stop => stop.OrderNo)
                .ToListAsync();

            var result = stops.Select(stop => new
            {
                stop.Id,
                stop.Name,
                stop.TransitRouteId,

                RouteName = stop.TransitRoute != null
                    ? stop.TransitRoute.Name
                    : null,

                RouteShortCode = stop.TransitRoute != null
                    ? stop.TransitRoute.ShortCode
                    : "",

                RouteColor = stop.TransitRoute != null
                    ? stop.TransitRoute.Color
                    : "#2563eb",

                stop.OrderNo,

                StopType = string.IsNullOrWhiteSpace(stop.StopType)
                    ? "Bus"
                    : stop.StopType,

                Wkt = writer.Write(stop.Geometry),

                stop.UserId,

                Username = stop.User != null
                    ? stop.User.Username
                    : null,

                ProfileImageUrl = stop.User != null
                    ? stop.User.ProfileImageUrl
                    : null,

                stop.IsActive,
                stop.CreatedDate,
                stop.ModifiedDate
            });

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Duraklar alınırken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetStop(int id)
    {
        try
        {
            var writer = new WKTWriter();

            var stop = await _context.TransitStops
                .Include(item => item.TransitRoute)
                .Include(item => item.User)
                .FirstOrDefaultAsync(item =>
                    item.Id == id &&
                    item.IsActive &&
                    !item.IsDeleted
                );

            if (stop == null)
            {
                return NotFound(new
                {
                    message = "Durak bulunamadı."
                });
            }

            return Ok(new
            {
                stop.Id,
                stop.Name,
                stop.TransitRouteId,

                RouteName = stop.TransitRoute != null
                    ? stop.TransitRoute.Name
                    : null,

                RouteShortCode = stop.TransitRoute != null
                    ? stop.TransitRoute.ShortCode
                    : "",

                RouteColor = stop.TransitRoute != null
                    ? stop.TransitRoute.Color
                    : "#2563eb",

                stop.OrderNo,

                StopType = string.IsNullOrWhiteSpace(stop.StopType)
                    ? "Bus"
                    : stop.StopType,

                Wkt = writer.Write(stop.Geometry),

                stop.UserId,

                Username = stop.User != null
                    ? stop.User.Username
                    : null,

                ProfileImageUrl = stop.User != null
                    ? stop.User.ProfileImageUrl
                    : null,

                stop.IsActive,
                stop.CreatedDate,
                stop.ModifiedDate
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Durak bilgisi alınırken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddStop(
        [FromBody] CreateTransitStopRequest request,
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
                "Ulaşım Operatörü",
                "Ulasim Operatoru"
            );

            if (!canManage)
            {
                return StatusCode(403, new
                {
                    message = "Durak ekleme yetkiniz bulunmamaktadır."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new
                {
                    message = "Durak adı boş olamaz."
                });
            }

            if (request.TransitRouteId <= 0)
            {
                return BadRequest(new
                {
                    message = "Bir güzergah seçilmelidir."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Wkt))
            {
                return BadRequest(new
                {
                    message = "Durak konumu boş olamaz."
                });
            }

            var normalizedStopType =
                NormalizeStopType(request.StopType);

            if (string.IsNullOrWhiteSpace(normalizedStopType))
            {
                return BadRequest(new
                {
                    message =
                        "Geçersiz durak tipi. Bus veya Metro kullanılmalıdır."
                });
            }

            var route = await _context.TransitRoutes
                .FirstOrDefaultAsync(item =>
                    item.Id == request.TransitRouteId &&
                    item.IsActive &&
                    !item.IsDeleted
                );

            if (route == null)
            {
                return BadRequest(new
                {
                    message = "Seçilen güzergah bulunamadı."
                });
            }

            var reader = new WKTReader();
            var geometry = reader.Read(request.Wkt);

            if (geometry is not NetTopologySuite.Geometries.Point point)
            {
                return BadRequest(new
                {
                    message = "Durak geometrisi Point olmalıdır."
                });
            }

            point.SRID = 4326;

            var lastOrderNo = await _context.TransitStops
                .Where(stop =>
                    stop.TransitRouteId == request.TransitRouteId &&
                    stop.IsActive &&
                    !stop.IsDeleted
                )
                .Select(stop => (int?)stop.OrderNo)
                .MaxAsync() ?? 0;

            var stop = new TransitStop
            {
                Name = request.Name.Trim(),
                TransitRouteId = request.TransitRouteId,
                StopType = normalizedStopType,
                Geometry = point,
                OrderNo = lastOrderNo + 1,
                UserId = userId,
                IsActive = true,
                IsDeleted = false,
                CreatedDate = DateTime.UtcNow
            };

            _context.TransitStops.Add(stop);
            await _context.SaveChangesAsync(
                cancellationToken
            );

            var routeUpdate =
                await TryRegenerateRouteAsync(
                    request.TransitRouteId,
                    userId,
                    reorderByCurrentGeometry: true,
                    cancellationToken
                );

            return Ok(new
            {
                message = "Durak başarıyla eklendi.",
                stop.Id,
                stop.OrderNo,
                stop.StopType,
                routeUpdate
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
                message = "Durak eklenirken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateStop(
        int id,
        [FromBody] UpdateTransitStopRequest request,
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
                "Ulaşım Operatörü",
                "Ulasim Operatoru"
            );

            if (!canManage)
            {
                return StatusCode(403, new
                {
                    message = "Durak güncelleme yetkiniz bulunmamaktadır."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new
                {
                    message = "Durak adı boş olamaz."
                });
            }

            if (request.TransitRouteId <= 0)
            {
                return BadRequest(new
                {
                    message = "Bir güzergah seçilmelidir."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Wkt))
            {
                return BadRequest(new
                {
                    message = "Durak konumu boş olamaz."
                });
            }

            var normalizedStopType =
                NormalizeStopType(request.StopType);

            if (string.IsNullOrWhiteSpace(normalizedStopType))
            {
                return BadRequest(new
                {
                    message =
                        "Geçersiz durak tipi. Bus veya Metro kullanılmalıdır."
                });
            }

            var stop = await _context.TransitStops
                .FirstOrDefaultAsync(item =>
                    item.Id == id &&
                    !item.IsDeleted
                );

            if (stop == null)
            {
                return NotFound(new
                {
                    message = "Durak bulunamadı."
                });
            }

            var route = await _context.TransitRoutes
                .FirstOrDefaultAsync(item =>
                    item.Id == request.TransitRouteId &&
                    item.IsActive &&
                    !item.IsDeleted
                );

            if (route == null)
            {
                return BadRequest(new
                {
                    message = "Seçilen güzergah bulunamadı."
                });
            }

            var reader = new WKTReader();
            var geometry = reader.Read(request.Wkt);

            if (geometry is not NetTopologySuite.Geometries.Point point)
            {
                return BadRequest(new
                {
                    message = "Durak geometrisi Point olmalıdır."
                });
            }

            point.SRID = 4326;

            var oldRouteId = stop.TransitRouteId;
            var routeChanged =
                oldRouteId != request.TransitRouteId;

            if (routeChanged)
            {
                var lastOrderNo = await _context.TransitStops
                    .Where(item =>
                        item.TransitRouteId ==
                            request.TransitRouteId &&
                        item.IsActive &&
                        !item.IsDeleted
                    )
                    .Select(item => (int?)item.OrderNo)
                    .MaxAsync() ?? 0;

                stop.OrderNo = lastOrderNo + 1;
            }

            stop.Name = request.Name.Trim();
            stop.TransitRouteId =
                request.TransitRouteId;
            stop.StopType = normalizedStopType;
            stop.Geometry = point;
            stop.IsActive = request.IsActive;
            stop.ModifiedDate = DateTime.UtcNow;
            stop.ModifiedUserId = userId;

            await _context.SaveChangesAsync(
                cancellationToken
            );

            object? oldRouteUpdate = null;

            if (routeChanged)
            {
                await NormalizeStopOrders(
                    oldRouteId,
                    cancellationToken
                );

                oldRouteUpdate =
                    await TryRegenerateRouteAsync(
                        oldRouteId,
                        userId,
                        reorderByCurrentGeometry: false,
                        cancellationToken
                    );
            }

            var newRouteUpdate =
                await TryRegenerateRouteAsync(
                    request.TransitRouteId,
                    userId,
                    reorderByCurrentGeometry: true,
                    cancellationToken
                );

            return Ok(new
            {
                message =
                    "Durak başarıyla güncellendi.",
                stop.Id,
                stop.StopType,
                oldRouteUpdate,
                routeUpdate = newRouteUpdate
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
                    "Durak güncellenirken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpPut("reorder")]
    public async Task<IActionResult> ReorderStops(
        [FromBody] ReorderTransitStopsRequest request,
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
                "Ulaşım Operatörü",
                "Ulasim Operatoru"
            );

            if (!canManage)
            {
                return StatusCode(403, new
                {
                    message =
                        "Durak sıralama yetkiniz bulunmamaktadır."
                });
            }

            if (request.TransitRouteId <= 0)
            {
                return BadRequest(new
                {
                    message =
                        "Geçerli bir güzergah seçilmelidir."
                });
            }

            if (request.Stops == null ||
                request.Stops.Count == 0)
            {
                return BadRequest(new
                {
                    message =
                        "Sıralanacak durak bulunamadı."
                });
            }

            var duplicateStopIds = request.Stops
                .GroupBy(item => item.StopId)
                .Any(group => group.Count() > 1);

            if (duplicateStopIds)
            {
                return BadRequest(new
                {
                    message =
                        "Aynı durak birden fazla kez gönderilemez."
                });
            }

            var stopIds = request.Stops
                .Select(item => item.StopId)
                .ToList();

            var stops = await _context.TransitStops
                .Where(stop =>
                    stopIds.Contains(stop.Id) &&
                    stop.TransitRouteId ==
                        request.TransitRouteId &&
                    stop.IsActive &&
                    !stop.IsDeleted
                )
                .ToListAsync();

            if (stops.Count != stopIds.Count)
            {
                return BadRequest(new
                {
                    message =
                        "Gönderilen duraklardan bazıları bu güzergaha ait değil."
                });
            }

            for (
                var index = 0;
                index < request.Stops.Count;
                index++
            )
            {
                var requestedStop =
                    request.Stops[index];

                var stop = stops.First(item =>
                    item.Id == requestedStop.StopId
                );

                stop.OrderNo = index + 1;
                stop.ModifiedDate =
                    DateTime.UtcNow;
                stop.ModifiedUserId =
                    userId;
            }

            await _context.SaveChangesAsync(
                cancellationToken
            );

            var routeUpdate =
                await TryRegenerateRouteAsync(
                    request.TransitRouteId,
                    userId,
                    reorderByCurrentGeometry: false,
                    cancellationToken
                );

            return Ok(new
            {
                message =
                    "Durak sıralaması başarıyla güncellendi.",
                routeUpdate
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
                    "Duraklar sıralanırken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteStop(
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
                "Ulaşım Operatörü",
                "Ulasim Operatoru"
            );

            if (!canManage)
            {
                return StatusCode(403, new
                {
                    message =
                        "Durak silme yetkiniz bulunmamaktadır."
                });
            }

            var stop = await _context.TransitStops
                .FirstOrDefaultAsync(item =>
                    item.Id == id &&
                    !item.IsDeleted
                );

            if (stop == null)
            {
                return NotFound(new
                {
                    message = "Durak bulunamadı."
                });
            }

            var routeId = stop.TransitRouteId;

            stop.IsDeleted = true;
            stop.IsActive = false;
            stop.ModifiedDate = DateTime.UtcNow;
            stop.ModifiedUserId = userId;

            await _context.SaveChangesAsync(
                cancellationToken
            );

            await NormalizeStopOrders(
                routeId,
                cancellationToken
            );

            var routeUpdate =
                await TryRegenerateRouteAsync(
                    routeId,
                    userId,
                    reorderByCurrentGeometry: false,
                    cancellationToken
                );

            return Ok(new
            {
                message =
                    "Durak başarıyla silindi.",
                stop.Id,
                routeUpdate
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
                    "Durak silinirken hata oluştu.",
                error = ex.Message
            });
        }
    }

    private async Task NormalizeStopOrders(
        int transitRouteId,
        CancellationToken cancellationToken = default
    )
    {
        var stops = await _context.TransitStops
            .Where(stop =>
                stop.TransitRouteId ==
                    transitRouteId &&
                stop.IsActive &&
                !stop.IsDeleted
            )
            .OrderBy(stop => stop.OrderNo)
            .ThenBy(stop => stop.Id)
            .ToListAsync();

        for (
            var index = 0;
            index < stops.Count;
            index++
        )
        {
            stops[index].OrderNo =
                index + 1;
        }

        await _context.SaveChangesAsync();
    }
}