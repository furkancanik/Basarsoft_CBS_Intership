using LoginMapApi.Data;
using LoginMapApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.IO;
using System.Security.Claims;

namespace LoginMapApi.Controllers;

public class CreatePoiRequest
{
    public string Name { get; set; } = "";

    public int PoiCategoryId { get; set; }

    public TimeSpan OpeningTime { get; set; }

    public TimeSpan ClosingTime { get; set; }

    public string Wkt { get; set; } = "";
}

public class UpdatePoiRequest
{
    public string Name { get; set; } = "";

    public int PoiCategoryId { get; set; }

    public TimeSpan OpeningTime { get; set; }

    public TimeSpan ClosingTime { get; set; }

    public string Wkt { get; set; } = "";

    public bool IsActive { get; set; } = true;
}

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class PoisController : ControllerBase
{
    private readonly AppDbContext _context;

    public PoisController(AppDbContext context)
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

    [HttpGet]
    public async Task<IActionResult> GetPois()
    {
        try
        {
            var writer = new WKTWriter();

            var pois = await _context.Pois
                .Where(poi =>
                    poi.IsActive &&
                    !poi.IsDeleted
                )
                .Include(poi => poi.PoiCategory)
                    .ThenInclude(category => category!.Parent)
                .Include(poi => poi.User)
                .OrderByDescending(poi => poi.CreatedDate)
                .ToListAsync();

            var result = pois.Select(poi => new
            {
                poi.Id,
                poi.Name,
                poi.PoiCategoryId,

                CategoryName = poi.PoiCategory != null
                    ? poi.PoiCategory.Name
                    : null,

                ParentCategoryName =
                    poi.PoiCategory != null &&
                    poi.PoiCategory.Parent != null
                        ? poi.PoiCategory.Parent.Name
                        : null,

                poi.OpeningTime,
                poi.ClosingTime,

                Wkt = writer.Write(poi.Geometry),

                poi.UserId,

                Username = poi.User != null
                    ? poi.User.Username
                    : null,

                ProfileImageUrl = poi.User != null
                    ? poi.User.ProfileImageUrl
                    : null,

                poi.IsActive,
                poi.CreatedDate,
                poi.ModifiedDate
            });

            return Ok(result);
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
                message = "POI kayıtları alınırken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetPoi(int id)
    {
        try
        {
            var writer = new WKTWriter();

            var poi = await _context.Pois
                .Include(item => item.PoiCategory)
                    .ThenInclude(category => category!.Parent)
                .Include(item => item.User)
                .FirstOrDefaultAsync(item =>
                    item.Id == id &&
                    item.IsActive &&
                    !item.IsDeleted
                );

            if (poi == null)
            {
                return NotFound(new
                {
                    message = "POI bulunamadı."
                });
            }

            return Ok(new
            {
                poi.Id,
                poi.Name,
                poi.PoiCategoryId,

                CategoryName = poi.PoiCategory != null
                    ? poi.PoiCategory.Name
                    : null,

                ParentCategoryName =
                    poi.PoiCategory != null &&
                    poi.PoiCategory.Parent != null
                        ? poi.PoiCategory.Parent.Name
                        : null,

                poi.OpeningTime,
                poi.ClosingTime,

                Wkt = writer.Write(poi.Geometry),

                poi.UserId,

                Username = poi.User != null
                    ? poi.User.Username
                    : null,

                ProfileImageUrl = poi.User != null
                    ? poi.User.ProfileImageUrl
                    : null,

                poi.IsActive,
                poi.CreatedDate,
                poi.ModifiedDate
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
                message = "POI bilgisi alınırken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddPoi(
        [FromBody] CreatePoiRequest request
    )
    {
        try
        {
            var userId = GetUserId();

            var canCreatePoi = await UserHasRole(
                "Admin",
                "Operator",
                "Operatör"
            );

            if (!canCreatePoi)
            {
                return StatusCode(403, new
                {
                    message = "POI ekleme yetkiniz bulunmamaktadır."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new
                {
                    message = "POI adı boş olamaz."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Wkt))
            {
                return BadRequest(new
                {
                    message = "POI konumu boş olamaz."
                });
            }

            if (request.PoiCategoryId <= 0)
            {
                return BadRequest(new
                {
                    message = "Geçerli bir kategori seçilmelidir."
                });
            }

            if (request.OpeningTime >= request.ClosingTime)
            {
                return BadRequest(new
                {
                    message =
                        "Kapanış saati açılış saatinden sonra olmalıdır."
                });
            }

            var category = await _context.PoiCategories
                .FirstOrDefaultAsync(item =>
                    item.Id == request.PoiCategoryId &&
                    item.IsActive &&
                    !item.IsDeleted
                );

            if (category == null)
            {
                return BadRequest(new
                {
                    message = "Seçilen kategori bulunamadı."
                });
            }

            if (category.ParentId == null)
            {
                return BadRequest(new
                {
                    message = "POI için bir alt kategori seçilmelidir."
                });
            }

            var reader = new WKTReader();
            var geometry = reader.Read(request.Wkt);

            if (geometry is not NetTopologySuite.Geometries.Point point)
            {
                return BadRequest(new
                {
                    message = "POI geometrisi Point olmalıdır."
                });
            }

            point.SRID = 4326;

            var poi = new Poi
            {
                Name = request.Name.Trim(),
                PoiCategoryId = request.PoiCategoryId,
                OpeningTime = request.OpeningTime,
                ClosingTime = request.ClosingTime,
                Geometry = point,
                UserId = userId,
                IsActive = true,
                IsDeleted = false,
                CreatedDate = DateTime.UtcNow
            };

            _context.Pois.Add(poi);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "POI başarıyla eklendi.",
                poi.Id
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
                message = "POI eklenirken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdatePoi(
        int id,
        [FromBody] UpdatePoiRequest request
    )
    {
        try
        {
            var userId = GetUserId();

            var isAdmin = await UserHasRole("Admin");

            if (!isAdmin)
            {
                return StatusCode(403, new
                {
                    message = "POI güncelleme yetkiniz bulunmamaktadır."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new
                {
                    message = "POI adı boş olamaz."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Wkt))
            {
                return BadRequest(new
                {
                    message = "POI konumu boş olamaz."
                });
            }

            if (request.OpeningTime >= request.ClosingTime)
            {
                return BadRequest(new
                {
                    message =
                        "Kapanış saati açılış saatinden sonra olmalıdır."
                });
            }

            var poi = await _context.Pois
                .FirstOrDefaultAsync(item =>
                    item.Id == id &&
                    !item.IsDeleted
                );

            if (poi == null)
            {
                return NotFound(new
                {
                    message = "POI bulunamadı."
                });
            }

            var category = await _context.PoiCategories
                .FirstOrDefaultAsync(item =>
                    item.Id == request.PoiCategoryId &&
                    item.IsActive &&
                    !item.IsDeleted
                );

            if (category == null || category.ParentId == null)
            {
                return BadRequest(new
                {
                    message = "Geçerli bir alt kategori seçilmelidir."
                });
            }

            var reader = new WKTReader();
            var geometry = reader.Read(request.Wkt);

            if (geometry is not NetTopologySuite.Geometries.Point point)
            {
                return BadRequest(new
                {
                    message = "POI geometrisi Point olmalıdır."
                });
            }

            point.SRID = 4326;

            poi.Name = request.Name.Trim();
            poi.PoiCategoryId = request.PoiCategoryId;
            poi.OpeningTime = request.OpeningTime;
            poi.ClosingTime = request.ClosingTime;
            poi.Geometry = point;
            poi.IsActive = request.IsActive;
            poi.ModifiedDate = DateTime.UtcNow;
            poi.ModifiedUserId = userId;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "POI başarıyla güncellendi.",
                poi.Id
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
                message = "POI güncellenirken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeletePoi(int id)
    {
        try
        {
            var userId = GetUserId();

            var isAdmin = await UserHasRole("Admin");

            if (!isAdmin)
            {
                return StatusCode(403, new
                {
                    message = "POI silme yetkiniz bulunmamaktadır."
                });
            }

            var poi = await _context.Pois
                .FirstOrDefaultAsync(item =>
                    item.Id == id &&
                    !item.IsDeleted
                );

            if (poi == null)
            {
                return NotFound(new
                {
                    message = "POI bulunamadı."
                });
            }

            poi.IsDeleted = true;
            poi.IsActive = false;
            poi.ModifiedDate = DateTime.UtcNow;
            poi.ModifiedUserId = userId;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "POI başarıyla silindi.",
                poi.Id
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
                message = "POI silinirken hata oluştu.",
                error = ex.Message
            });
        }
    }
}