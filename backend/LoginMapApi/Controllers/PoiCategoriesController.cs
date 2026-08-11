using LoginMapApi.Data;
using LoginMapApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace LoginMapApi.Controllers;

public class CreatePoiCategoryRequest
{
    public string Name { get; set; } = "";

    public int? ParentId { get; set; }
}

public class UpdatePoiCategoryRequest
{
    public string Name { get; set; } = "";

    public int? ParentId { get; set; }

    public bool IsActive { get; set; } = true;
}

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class PoiCategoriesController : ControllerBase
{
    private readonly AppDbContext _context;

    public PoiCategoriesController(AppDbContext context)
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
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var categories = await _context.PoiCategories
                .Where(category => !category.IsDeleted)
                .OrderBy(category => category.ParentId)
                .ThenBy(category => category.Name)
                .Select(category => new
                {
                    category.Id,
                    category.Name,
                    category.ParentId,

                    ParentName = category.Parent != null
                        ? category.Parent.Name
                        : null,

                    category.IsActive,
                    category.CreatedDate,
                    category.ModifiedDate
                })
                .ToListAsync();

            return Ok(categories);
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
                message = "Kategoriler alınırken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpGet("tree")]
    public async Task<IActionResult> GetTree()
    {
        try
        {
            var categories = await _context.PoiCategories
                .Where(category =>
                    category.IsActive &&
                    !category.IsDeleted
                )
                .Select(category => new
                {
                    category.Id,
                    category.Name,
                    category.ParentId
                })
                .ToListAsync();

            var tree = categories
                .Where(category => category.ParentId == null)
                .Select(parent => new
                {
                    parent.Id,
                    parent.Name,

                    Children = categories
                        .Where(child =>
                            child.ParentId == parent.Id
                        )
                        .Select(child => new
                        {
                            child.Id,
                            child.Name
                        })
                        .OrderBy(child => child.Name)
                        .ToList()
                })
                .OrderBy(parent => parent.Name)
                .ToList();

            return Ok(tree);
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
                message = "Kategori ağacı alınırken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreatePoiCategoryRequest request
    )
    {
        try
        {
            var isAdmin = await UserHasRole("Admin");

            if (!isAdmin)
            {
                return StatusCode(403, new
                {
                    message =
                        "Kategori ekleme yetkiniz bulunmamaktadır."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new
                {
                    message = "Kategori adı boş olamaz."
                });
            }

            if (request.ParentId.HasValue)
            {
                var parent = await _context.PoiCategories
                    .FirstOrDefaultAsync(category =>
                        category.Id == request.ParentId.Value &&
                        category.IsActive &&
                        !category.IsDeleted
                    );

                if (parent == null)
                {
                    return BadRequest(new
                    {
                        message =
                            "Seçilen ana kategori bulunamadı."
                    });
                }

                if (parent.ParentId.HasValue)
                {
                    return BadRequest(new
                    {
                        message =
                            "Alt kategori, başka bir alt kategorinin altında oluşturulamaz."
                    });
                }
            }

            var normalizedName = request.Name
                .Trim()
                .ToLower();

            var duplicateExists =
                await _context.PoiCategories.AnyAsync(
                    category =>
                        category.Name.ToLower() ==
                            normalizedName &&
                        category.ParentId == request.ParentId &&
                        !category.IsDeleted
                );

            if (duplicateExists)
            {
                return BadRequest(new
                {
                    message = "Bu kategori zaten mevcut."
                });
            }

            var category = new PoiCategory
            {
                Name = request.Name.Trim(),
                ParentId = request.ParentId,
                CreatedUserId = GetUserId(),
                IsActive = true,
                IsDeleted = false,
                CreatedDate = DateTime.UtcNow
            };

            _context.PoiCategories.Add(category);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Kategori başarıyla eklendi.",
                category.Id
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
                message = "Kategori eklenirken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] UpdatePoiCategoryRequest request
    )
    {
        try
        {
            var isAdmin = await UserHasRole("Admin");

            if (!isAdmin)
            {
                return StatusCode(403, new
                {
                    message =
                        "Kategori güncelleme yetkiniz bulunmamaktadır."
                });
            }

            var category = await _context.PoiCategories
                .FirstOrDefaultAsync(item =>
                    item.Id == id &&
                    !item.IsDeleted
                );

            if (category == null)
            {
                return NotFound(new
                {
                    message = "Kategori bulunamadı."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new
                {
                    message = "Kategori adı boş olamaz."
                });
            }

            if (request.ParentId == id)
            {
                return BadRequest(new
                {
                    message =
                        "Kategori kendisinin üst kategorisi olamaz."
                });
            }

            if (request.ParentId.HasValue)
            {
                var parent = await _context.PoiCategories
                    .FirstOrDefaultAsync(item =>
                        item.Id == request.ParentId.Value &&
                        item.IsActive &&
                        !item.IsDeleted
                    );

                if (parent == null)
                {
                    return BadRequest(new
                    {
                        message =
                            "Seçilen ana kategori bulunamadı."
                    });
                }

                if (parent.ParentId.HasValue)
                {
                    return BadRequest(new
                    {
                        message =
                            "Alt kategori, başka bir alt kategorinin üst kategorisi olamaz."
                    });
                }

                var isChildOfCurrentCategory =
                    await _context.PoiCategories.AnyAsync(
                        child =>
                            child.Id == request.ParentId.Value &&
                            child.ParentId == id &&
                            !child.IsDeleted
                    );

                if (isChildOfCurrentCategory)
                {
                    return BadRequest(new
                    {
                        message =
                            "Bir alt kategori üst kategori olarak seçilemez."
                    });
                }

                var hasChildren =
                    await _context.PoiCategories.AnyAsync(
                        child =>
                            child.ParentId == id &&
                            !child.IsDeleted
                    );

                if (hasChildren)
                {
                    return BadRequest(new
                    {
                        message =
                            "Alt kategorileri bulunan bir ana kategori, alt kategoriye dönüştürülemez."
                    });
                }
            }

            var normalizedName = request.Name
                .Trim()
                .ToLower();

            var duplicateExists =
                await _context.PoiCategories.AnyAsync(
                    item =>
                        item.Id != id &&
                        item.Name.ToLower() ==
                            normalizedName &&
                        item.ParentId == request.ParentId &&
                        !item.IsDeleted
                );

            if (duplicateExists)
            {
                return BadRequest(new
                {
                    message = "Bu kategori zaten mevcut."
                });
            }

            category.Name = request.Name.Trim();
            category.ParentId = request.ParentId;
            category.IsActive = request.IsActive;
            category.ModifiedDate = DateTime.UtcNow;
            category.ModifiedUserId = GetUserId();

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "Kategori başarıyla güncellendi."
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
                    "Kategori güncellenirken hata oluştu.",
                error = ex.Message
            });
        }
    }

[HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        await using var transaction =
            await _context.Database.BeginTransactionAsync();

        try
        {
            var isAdmin = await UserHasRole("Admin");

            if (!isAdmin)
            {
                return StatusCode(403, new
                {
                    message =
                        "Kategori silme yetkiniz bulunmamaktadır."
                });
            }

            var category = await _context.PoiCategories
                .FirstOrDefaultAsync(item =>
                    item.Id == id &&
                    !item.IsDeleted
                );

            if (category == null)
            {
                return NotFound(new
                {
                    message = "Kategori bulunamadı."
                });
            }

            var currentUserId = GetUserId();
            var now = DateTime.UtcNow;

            var childCategories = await _context.PoiCategories
                .Where(child =>
                    child.ParentId == id &&
                    !child.IsDeleted
                )
                .ToListAsync();

            var categoriesToDelete = new List<PoiCategory>
            {
                category
            };

            categoriesToDelete.AddRange(childCategories);

            var categoryIds = categoriesToDelete
                .Select(item => item.Id)
                .ToList();

            var linkedPois = await _context.Pois
                .Where(poi =>
                    categoryIds.Contains(poi.PoiCategoryId) &&
                    !poi.IsDeleted
                )
                .ToListAsync();

            foreach (var poi in linkedPois)
            {
                poi.IsDeleted = true;
                poi.IsActive = false;
                poi.ModifiedDate = now;
                poi.ModifiedUserId = currentUserId;
            }

            foreach (var item in categoriesToDelete)
            {
                item.IsDeleted = true;
                item.IsActive = false;
                item.ModifiedDate = now;
                item.ModifiedUserId = currentUserId;
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                message =
                    linkedPois.Count > 0 || childCategories.Count > 0
                        ? "Kategori, bağlı alt kategoriler ve POI kayıtları başarıyla silindi."
                        : "Kategori başarıyla silindi.",

                deletedCategoryCount = categoriesToDelete.Count,
                deletedPoiCount = linkedPois.Count
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            await transaction.RollbackAsync();

            return Unauthorized(new
            {
                message = ex.Message
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();

            return StatusCode(500, new
            {
                message = "Kategori silinirken hata oluştu.",
                error = ex.Message
            });
        }
    }
}
