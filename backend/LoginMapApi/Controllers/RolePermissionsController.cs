using LoginMapApi.Data;
using LoginMapApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoginMapApi.Controllers;

public class RolePermissionRequest
{
    public int RoleId { get; set; }
    public int PermissionId { get; set; }
}

[ApiController]
[Route("api/[controller]")]
public class RolePermissionsController : ControllerBase
{
    private readonly AppDbContext _context;

    public RolePermissionsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetRolePermissions()
    {
        var rolePermissions = await _context.RolePermissions
            .Include(rp => rp.Role)
            .Include(rp => rp.Permission)
            .OrderBy(rp => rp.Id)
            .Select(rp => new
            {
                rp.Id,
                rp.RoleId,
                RoleName = rp.Role.Name,
                rp.PermissionId,
                PermissionName = rp.Permission.Name
            })
            .ToListAsync();

        return Ok(rolePermissions);
    }

    [HttpPost]
    public async Task<IActionResult> AssignPermissionToRole(RolePermissionRequest request)
    {
        var exists = await _context.RolePermissions.AnyAsync(rp =>
            rp.RoleId == request.RoleId &&
            rp.PermissionId == request.PermissionId
        );

        if (exists)
            return BadRequest("Bu yetki bu role zaten atanmış.");

        var rolePermission = new RolePermission
        {
            RoleId = request.RoleId,
            PermissionId = request.PermissionId
        };

        _context.RolePermissions.Add(rolePermission);
        await _context.SaveChangesAsync();

        return Ok(rolePermission);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRolePermission(int id)
    {
        var rolePermission = await _context.RolePermissions.FindAsync(id);

        if (rolePermission == null)
            return NotFound("Rol-yetki ilişkisi bulunamadı.");

        _context.RolePermissions.Remove(rolePermission);
        await _context.SaveChangesAsync();

        return Ok("Rolden yetki kaldırıldı.");
    }
}