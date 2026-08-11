using System.Security.Claims;
using LoginMapApi.Data;
using LoginMapApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoginMapApi.Controllers;

public class CreateTransitScheduleRequest
{
    public int TransitRouteId { get; set; }
    public string Name { get; set; } = "";
    public DateTime ValidFrom { get; set; } = DateTime.UtcNow.Date;
    public DateTime? ValidTo { get; set; }
    public bool RunsMonday { get; set; } = true;
    public bool RunsTuesday { get; set; } = true;
    public bool RunsWednesday { get; set; } = true;
    public bool RunsThursday { get; set; } = true;
    public bool RunsFriday { get; set; } = true;
    public bool RunsSaturday { get; set; }
    public bool RunsSunday { get; set; }
}

public class CreateTransitTripRequest
{
    public int TransitRouteId { get; set; }
    public int TransitScheduleId { get; set; }
    public string TripCode { get; set; } = "";
    public string VehicleType { get; set; } = "Bus";
    public string DepartureTime { get; set; } = "08:00";
    public int StopDwellSeconds { get; set; } = 10;
}

public class UpdateTransitTripRequest
{
    public int TransitScheduleId { get; set; }
    public string TripCode { get; set; } = "";
    public string VehicleType { get; set; } = "Bus";
    public string DepartureTime { get; set; } = "08:00";
    public bool IsActive { get; set; } = true;
    public int StopDwellSeconds { get; set; } = 10;
}

[Authorize]
[ApiController]
[Route("api/transit-trips")]
public class TransitTripsController : ControllerBase
{
    private readonly AppDbContext _context;

    public TransitTripsController(AppDbContext context)
    {
        _context = context;
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

    private async Task<bool> UserCanManageAsync()
    {
        var userId = GetUserId();
        var allowedRoles = new[]
        {
            "Admin",
            "Operator",
            "Operatör",
            "Ulaşım Operatörü",
            "Ulasim Operatoru"
        };

        var roleNames = await _context.UserRoles
            .Where(item => item.UserId == userId)
            .Join(
                _context.Roles,
                item => item.RoleId,
                role => role.Id,
                (_, role) => role
            )
            .Where(role => role.IsActive && !role.IsDeleted)
            .Select(role => role.Name)
            .ToListAsync();

        return roleNames.Any(roleName =>
            allowedRoles.Any(allowedRole =>
                NormalizeRoleName(roleName) ==
                NormalizeRoleName(allowedRole)
            )
        );
    }

    private static string NormalizeVehicleType(string? value)
    {
        return string.Equals(value?.Trim(), "Metro", StringComparison.OrdinalIgnoreCase)
            ? "Metro"
            : "Bus";
    }

    private static bool TryParseDepartureTime(
        string? value,
        out TimeOnly departureTime
    )
    {
        return TimeOnly.TryParse(value, out departureTime);
    }

    [HttpGet("schedules")]
    public async Task<IActionResult> GetSchedules([FromQuery] int? routeId)
    {
        var query = _context.TransitSchedules
            .Where(item => !item.IsDeleted)
            .Include(item => item.TransitRoute)
            .AsNoTracking()
            .AsQueryable();

        if (routeId.HasValue)
        {
            query = query.Where(item => item.TransitRouteId == routeId.Value);
        }

        var result = await query
            .OrderBy(item => item.TransitRouteId)
            .ThenBy(item => item.Name)
            .Select(item => new
            {
                item.Id,
                item.TransitRouteId,
                RouteName = item.TransitRoute != null
                    ? item.TransitRoute.Name
                    : "",
                item.Name,
                item.ValidFrom,
                item.ValidTo,
                item.RunsMonday,
                item.RunsTuesday,
                item.RunsWednesday,
                item.RunsThursday,
                item.RunsFriday,
                item.RunsSaturday,
                item.RunsSunday,
                item.IsActive
            })
            .ToListAsync();

        return Ok(result);
    }

    [HttpPost("schedules")]
    public async Task<IActionResult> CreateSchedule(
        [FromBody] CreateTransitScheduleRequest request
    )
    {
        if (!await UserCanManageAsync())
        {
            return StatusCode(403, new
            {
                message = "Sefer takvimi oluşturma yetkiniz bulunmamaktadır."
            });
        }

        var routeExists = await _context.TransitRoutes.AnyAsync(route =>
            route.Id == request.TransitRouteId &&
            route.IsActive &&
            !route.IsDeleted
        );

        if (!routeExists)
        {
            return BadRequest(new { message = "Güzergah bulunamadı." });
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Takvim adı boş olamaz." });
        }

        if (request.ValidTo.HasValue && request.ValidTo.Value.Date < request.ValidFrom.Date)
        {
            return BadRequest(new
            {
                message = "Bitiş tarihi başlangıç tarihinden önce olamaz."
            });
        }

        var schedule = new TransitSchedule
        {
            TransitRouteId = request.TransitRouteId,
            Name = request.Name.Trim(),
            ValidFrom = DateTime.SpecifyKind(request.ValidFrom.Date, DateTimeKind.Utc),
            ValidTo = request.ValidTo.HasValue
                ? DateTime.SpecifyKind(request.ValidTo.Value.Date, DateTimeKind.Utc)
                : null,
            RunsMonday = request.RunsMonday,
            RunsTuesday = request.RunsTuesday,
            RunsWednesday = request.RunsWednesday,
            RunsThursday = request.RunsThursday,
            RunsFriday = request.RunsFriday,
            RunsSaturday = request.RunsSaturday,
            RunsSunday = request.RunsSunday,
            IsActive = true,
            IsDeleted = false,
            CreatedDate = DateTime.UtcNow
        };

        _context.TransitSchedules.Add(schedule);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Sefer takvimi oluşturuldu.",
            schedule.Id
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetTrips([FromQuery] int? routeId)
    {
        var query = _context.TransitTrips
            .Where(item => !item.IsDeleted)
            .Include(item => item.TransitRoute)
            .Include(item => item.TransitSchedule)
            .Include(item => item.Stops)
                .ThenInclude(item => item.TransitStop)
            .AsNoTracking()
            .AsQueryable();

        if (routeId.HasValue)
        {
            query = query.Where(item => item.TransitRouteId == routeId.Value);
        }

        var trips = await query
            .OrderBy(item => item.TransitRouteId)
            .ThenBy(item => item.DepartureTime)
            .ToListAsync();

        return Ok(trips.Select(trip => new
        {
            trip.Id,
            trip.TransitRouteId,
            RouteName = trip.TransitRoute?.Name ?? "",
            RouteShortCode = trip.TransitRoute?.ShortCode ?? "",
            trip.TransitScheduleId,
            ScheduleName = trip.TransitSchedule?.Name ?? "",
            trip.TripCode,
            trip.VehicleType,
            DepartureTime = trip.DepartureTime.ToString("HH:mm:ss"),
            trip.IsActive,
            Stops = trip.Stops
                .OrderBy(item => item.StopSequence)
                .Select(item => new
                {
                    item.Id,
                    item.TransitStopId,
                    StopName = item.TransitStop?.Name ?? "",
                    item.StopSequence,
                    item.ArrivalOffsetSeconds,
                    item.DepartureOffsetSeconds,
                    item.DwellSeconds
                })
        }));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetTrip(int id)
    {
        var trip = await _context.TransitTrips
            .Where(item => item.Id == id && !item.IsDeleted)
            .Include(item => item.TransitRoute)
            .Include(item => item.TransitSchedule)
            .Include(item => item.Stops)
                .ThenInclude(item => item.TransitStop)
            .AsNoTracking()
            .FirstOrDefaultAsync();

        if (trip == null)
        {
            return NotFound(new { message = "Sefer bulunamadı." });
        }

        return Ok(new
        {
            trip.Id,
            trip.TransitRouteId,
            RouteName = trip.TransitRoute?.Name ?? "",
            RouteShortCode = trip.TransitRoute?.ShortCode ?? "",
            trip.TransitScheduleId,
            ScheduleName = trip.TransitSchedule?.Name ?? "",
            trip.TripCode,
            trip.VehicleType,
            DepartureTime = trip.DepartureTime.ToString("HH:mm:ss"),
            trip.IsActive,
            Stops = trip.Stops
                .OrderBy(item => item.StopSequence)
                .Select(item => new
                {
                    item.Id,
                    item.TransitStopId,
                    StopName = item.TransitStop?.Name ?? "",
                    item.StopSequence,
                    item.ArrivalOffsetSeconds,
                    item.DepartureOffsetSeconds,
                    item.DwellSeconds
                })
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateTrip(
        [FromBody] CreateTransitTripRequest request
    )
    {
        var userId = GetUserId();

        if (!await UserCanManageAsync())
        {
            return StatusCode(403, new
            {
                message = "Sefer oluşturma yetkiniz bulunmamaktadır."
            });
        }

        if (!TryParseDepartureTime(request.DepartureTime, out var departureTime))
        {
            return BadRequest(new
            {
                message = "Kalkış saati HH:mm biçiminde olmalıdır."
            });
        }

        var route = await _context.TransitRoutes
            .Where(item =>
                item.Id == request.TransitRouteId &&
                item.IsActive &&
                !item.IsDeleted
            )
            .Include(item => item.Stops.Where(stop =>
                stop.IsActive && !stop.IsDeleted
            ))
            .FirstOrDefaultAsync();

        if (route == null)
        {
            return BadRequest(new { message = "Güzergah bulunamadı." });
        }

        var schedule = await _context.TransitSchedules.FirstOrDefaultAsync(item =>
            item.Id == request.TransitScheduleId &&
            item.TransitRouteId == request.TransitRouteId &&
            item.IsActive &&
            !item.IsDeleted
        );

        if (schedule == null)
        {
            return BadRequest(new
            {
                message = "Bu güzergaha ait aktif sefer takvimi bulunamadı."
            });
        }

        var tripCode = request.TripCode.Trim().ToUpperInvariant();

        if (string.IsNullOrWhiteSpace(tripCode))
        {
            return BadRequest(new { message = "Sefer kodu boş olamaz." });
        }

        var duplicate = await _context.TransitTrips.AnyAsync(item =>
            !item.IsDeleted && item.TripCode == tripCode
        );

        if (duplicate)
        {
            return BadRequest(new
            {
                message = "Bu sefer kodu zaten kullanılıyor."
            });
        }

        var orderedStops = route.Stops
            .OrderBy(item => item.OrderNo)
            .ThenBy(item => item.Id)
            .ToList();

        if (orderedStops.Count < 2)
        {
            return BadRequest(new
            {
                message = "Sefer oluşturmak için en az iki aktif durak gerekir."
            });
        }

        var dwellSeconds = Math.Clamp(request.StopDwellSeconds, 0, 600);
        var routeDurationSeconds = Math.Max(
            orderedStops.Count - 1,
            route.DurationSeconds ?? (orderedStops.Count - 1) * 300
        );
        var travelDurationWithoutDwells = Math.Max(
            orderedStops.Count - 1,
            routeDurationSeconds - dwellSeconds * Math.Max(0, orderedStops.Count - 2)
        );
        var segmentDuration = travelDurationWithoutDwells / (orderedStops.Count - 1);

        var trip = new TransitTrip
        {
            TransitRouteId = request.TransitRouteId,
            TransitScheduleId = request.TransitScheduleId,
            TripCode = tripCode,
            VehicleType = NormalizeVehicleType(request.VehicleType),
            DepartureTime = departureTime,
            IsActive = true,
            IsDeleted = false,
            CreatedDate = DateTime.UtcNow,
            ModifiedUserId = userId
        };

        var accumulatedSeconds = 0.0;

        for (var index = 0; index < orderedStops.Count; index++)
        {
            var isFirstStop = index == 0;
            var isLastStop = index == orderedStops.Count - 1;
            var arrivalOffset = isFirstStop
                ? 0
                : (int)Math.Round(accumulatedSeconds);
            var departureOffset = isLastStop
                ? arrivalOffset
                : arrivalOffset + (isFirstStop ? 0 : dwellSeconds);

            trip.Stops.Add(new TransitTripStop
            {
                TransitStopId = orderedStops[index].Id,
                StopSequence = index + 1,
                ArrivalOffsetSeconds = arrivalOffset,
                DepartureOffsetSeconds = departureOffset,
                DwellSeconds = isFirstStop || isLastStop ? 0 : dwellSeconds
            });

            if (!isLastStop)
            {
                accumulatedSeconds = departureOffset + segmentDuration;
            }
        }

        _context.TransitTrips.Add(trip);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Sefer başarıyla oluşturuldu.",
            trip.Id,
            trip.TripCode
        });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateTrip(
        int id,
        [FromBody] UpdateTransitTripRequest request
    )
    {
        var userId = GetUserId();

        if (!await UserCanManageAsync())
        {
            return StatusCode(403, new
            {
                message = "Sefer güncelleme yetkiniz bulunmamaktadır."
            });
        }

        if (!TryParseDepartureTime(request.DepartureTime, out var departureTime))
        {
            return BadRequest(new
            {
                message = "Kalkış saati HH:mm biçiminde olmalıdır."
            });
        }

        var trip = await _context.TransitTrips
            .Include(item => item.Stops)
            .FirstOrDefaultAsync(item => item.Id == id && !item.IsDeleted);

        if (trip == null)
        {
            return NotFound(new { message = "Sefer bulunamadı." });
        }

        var scheduleExists = await _context.TransitSchedules.AnyAsync(item =>
            item.Id == request.TransitScheduleId &&
            item.TransitRouteId == trip.TransitRouteId &&
            item.IsActive &&
            !item.IsDeleted
        );

        if (!scheduleExists)
        {
            return BadRequest(new
            {
                message = "Bu güzergaha ait aktif sefer takvimi bulunamadı."
            });
        }

        var tripCode = request.TripCode.Trim().ToUpperInvariant();
        var duplicate = await _context.TransitTrips.AnyAsync(item =>
            item.Id != id &&
            !item.IsDeleted &&
            item.TripCode == tripCode
        );

        if (duplicate)
        {
            return BadRequest(new
            {
                message = "Bu sefer kodu başka bir seferde kullanılıyor."
            });
        }

        trip.TransitScheduleId = request.TransitScheduleId;
        trip.TripCode = tripCode;
        trip.VehicleType = NormalizeVehicleType(request.VehicleType);
        trip.DepartureTime = departureTime;
        trip.IsActive = request.IsActive;
        trip.ModifiedDate = DateTime.UtcNow;
        trip.ModifiedUserId = userId;

        var dwellSeconds = Math.Clamp(request.StopDwellSeconds, 0, 600);
        foreach (var tripStop in trip.Stops)
        {
            if (tripStop.StopSequence != 1 &&
                tripStop.StopSequence != trip.Stops.Count)
            {
                tripStop.DwellSeconds = dwellSeconds;
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = "Sefer güncellendi." });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteTrip(int id)
    {
        var userId = GetUserId();

        if (!await UserCanManageAsync())
        {
            return StatusCode(403, new
            {
                message = "Sefer silme yetkiniz bulunmamaktadır."
            });
        }

        var trip = await _context.TransitTrips.FirstOrDefaultAsync(item =>
            item.Id == id && !item.IsDeleted
        );

        if (trip == null)
        {
            return NotFound(new { message = "Sefer bulunamadı." });
        }

        trip.IsDeleted = true;
        trip.IsActive = false;
        trip.ModifiedDate = DateTime.UtcNow;
        trip.ModifiedUserId = userId;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Sefer silindi." });
    }
}
