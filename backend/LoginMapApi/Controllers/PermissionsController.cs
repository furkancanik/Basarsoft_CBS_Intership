using LoginMapApi.Data;
using LoginMapApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoginMapApi.Controllers;

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