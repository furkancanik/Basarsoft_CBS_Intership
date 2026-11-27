using LoginMapApi.Data;
using LoginMapApi.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoginMapApi.Controllers;

public class UserPermissionRequest
{
    public int UserId { get; set; }
    public int PermissionId { get; set; }
}

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UserPermissionsController : ControllerBase
{
    private readonly AppDbContext _context;

    public UserPermissionsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetUserPermissions()
    {
        // Admin tüm kayıtları, diğer kullanıcılar yalnızca kendi
        // doğrudan yetkilerini görür.
        var isAdmin = await AdminAccess.IsAdminAsync(_context, User);
        var currentUserId = AdminAccess.GetUserId(User) ?? -1;

        var userPermissions = await _context.UserPermissions
            .Where(up => isAdmin || up.UserId == currentUserId)
            .Include(up => up.User)
            .Include(up => up.Permission)
            .OrderBy(up => up.Id)
            .Select(up => new
            {
                up.Id,
                up.UserId,
                Username = up.User.Username,
                up.PermissionId,
                PermissionName = up.Permission.Name,
                Source = "Kullanıcıdan"
            })
            .ToListAsync();

        return Ok(userPermissions);
    }

    [AdminOnly]
    [HttpPost]
    public async Task<IActionResult> AssignPermissionToUser(UserPermissionRequest request)
    {
        var exists = await _context.UserPermissions.AnyAsync(up =>
            up.UserId == request.UserId &&
            up.PermissionId == request.PermissionId);

        if (exists)
            return BadRequest("Bu yetki kullanıcıya zaten atanmış.");

        var hasPermissionFromRole = await _context.UserRoles
            .Where(ur => ur.UserId == request.UserId)
            .Join(
                _context.RolePermissions,
                ur => ur.RoleId,
                rp => rp.RoleId,
                (ur, rp) => rp
            )
            .AnyAsync(rp => rp.PermissionId == request.PermissionId);

        if (hasPermissionFromRole)
            return BadRequest("Bu yetki kullanıcıya rol üzerinden zaten verilmiş.");

        var userPermission = new LoginMapApi.Models.UserPermission
        {
            UserId = request.UserId,
            PermissionId = request.PermissionId
        };

        _context.UserPermissions.Add(userPermission);
        await _context.SaveChangesAsync();

        return Ok(userPermission);
    }

    [AdminOnly]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUserPermission(int id)
    {
        var userPermission = await _context.UserPermissions.FindAsync(id);

        if (userPermission == null)
            return NotFound("Kullanıcı-yetki ilişkisi bulunamadı.");

        _context.UserPermissions.Remove(userPermission);
        await _context.SaveChangesAsync();

        return Ok("Kullanıcıdan yetki kaldırıldı.");
    }
}