using LoginMapApi.Data;
using LoginMapApi.Models;
using LoginMapApi.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoginMapApi.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class PermissionsController : ControllerBase
{
    private readonly AppDbContext _context;

    public PermissionsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetPermissions()
    {
        var permissions = await _context.Permissions
            .Where(p => p.IsDeleted == false)
            .OrderBy(p => p.Id)
            .ToListAsync();

        return Ok(permissions);
    }

    [AdminOnly]
    [HttpPost]
    public async Task<IActionResult> CreatePermission(Permission permission)
    {
        permission.Id = 0;
        permission.IsActive = true;
        permission.IsDeleted = false;
        permission.CreatedDate = DateTime.UtcNow;

        _context.Permissions.Add(permission);
        await _context.SaveChangesAsync();

        return Ok(permission);
    }

    [AdminOnly]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePermission(int id, Permission request)
    {
        var permission = await _context.Permissions.FindAsync(id);

        if (permission == null || permission.IsDeleted)
            return NotFound("Yetki bulunamadı.");

        permission.Name = request.Name;
        permission.Description = request.Description;
        permission.IsActive = request.IsActive;

        await _context.SaveChangesAsync();

        return Ok(permission);
    }

    [AdminOnly]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePermission(int id)
    {
        var permission = await _context.Permissions.FindAsync(id);

        if (permission == null || permission.IsDeleted)
            return NotFound("Yetki bulunamadı.");

        permission.IsDeleted = true;
        permission.IsActive = false;

        await _context.SaveChangesAsync();

        return Ok("Yetki silindi.");
    }
}