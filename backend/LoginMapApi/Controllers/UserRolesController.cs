using LoginMapApi.Data;
using LoginMapApi.Models;
using LoginMapApi.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoginMapApi.Controllers;

public class UserRoleRequest
{
    public int UserId { get; set; }
    public int RoleId { get; set; }
}

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UserRolesController : ControllerBase
{
    private readonly AppDbContext _context;

    public UserRolesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetUserRoles()
    {
        // Admin tüm kayıtları, diğer kullanıcılar yalnızca kendi
        // rollerini görür (arayüz menü yetkileri için kullanır).
        var isAdmin = await AdminAccess.IsAdminAsync(_context, User);
        var currentUserId = AdminAccess.GetUserId(User) ?? -1;

        var userRoles = await _context.UserRoles
            .AsNoTracking()
            .Where(ur => isAdmin || ur.UserId == currentUserId)
            .Where(ur =>
                ur.User.IsActive &&
                !ur.User.IsDeleted &&
                ur.Role.IsActive &&
                !ur.Role.IsDeleted
            )
            .OrderBy(ur => ur.Id)
            .Select(ur => new
            {
                ur.Id,
                ur.UserId,
                Username = ur.User.Username,
                ur.RoleId,
                RoleName = ur.Role.Name
            })
            .ToListAsync();

        return Ok(userRoles);
    }

    [AdminOnly]
    [HttpPost]
    public async Task<IActionResult> AssignRole(
        [FromBody] UserRoleRequest request
    )
    {
        if (request.UserId <= 0 || request.RoleId <= 0)
        {
            return BadRequest("Kullanıcı ve rol seçilmelidir.");
        }

        var userExists = await _context.Users.AnyAsync(user =>
            user.Id == request.UserId &&
            user.IsActive &&
            !user.IsDeleted
        );

        if (!userExists)
        {
            return BadRequest(
                "Seçilen kullanıcı bulunamadı veya aktif değil."
            );
        }

        var roleExists = await _context.Roles.AnyAsync(role =>
            role.Id == request.RoleId &&
            role.IsActive &&
            !role.IsDeleted
        );

        if (!roleExists)
        {
            return BadRequest(
                "Seçilen rol bulunamadı veya aktif değil."
            );
        }

        var exists = await _context.UserRoles.AnyAsync(ur =>
            ur.UserId == request.UserId &&
            ur.RoleId == request.RoleId
        );

        if (exists)
        {
            return BadRequest(
                "Bu kullanıcıya bu rol zaten atanmış."
            );
        }

        var userRole = new UserRole
        {
            UserId = request.UserId,
            RoleId = request.RoleId
        };

        _context.UserRoles.Add(userRole);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            userRole.Id,
            userRole.UserId,
            userRole.RoleId,
            Message = "Rol kullanıcıya başarıyla atandı."
        });
    }

    [AdminOnly]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteUserRole(int id)
    {
        var userRole = await _context.UserRoles
            .FirstOrDefaultAsync(ur => ur.Id == id);

        if (userRole == null)
        {
            return NotFound(
                "Kullanıcı-rol ilişkisi bulunamadı."
            );
        }

        _context.UserRoles.Remove(userRole);
        await _context.SaveChangesAsync();

        return Ok("Kullanıcıdan rol kaldırıldı.");
    }
}