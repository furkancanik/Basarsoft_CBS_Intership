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
public class RolesController : ControllerBase
{
    private readonly AppDbContext _context;

    public RolesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetRoles()
    {
        var roles = await _context.Roles
            .Where(r => r.IsDeleted == false)
            .OrderBy(r => r.Id)
            .ToListAsync();

        return Ok(roles);
    }

    [AdminOnly]
    [HttpPost]
    public async Task<IActionResult> CreateRole(Role role)
    {
        role.Id = 0;
        role.IsActive = true;
        role.IsDeleted = false;
        role.CreatedDate = DateTime.UtcNow;

        _context.Roles.Add(role);
        await _context.SaveChangesAsync();

        return Ok(role);
    }

    [AdminOnly]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateRole(int id, Role request)
    {
        var role = await _context.Roles.FindAsync(id);

        if (role == null || role.IsDeleted)
            return NotFound("Rol bulunamadı.");

        role.Name = request.Name;
        role.Description = request.Description;
        role.IsActive = request.IsActive;

        await _context.SaveChangesAsync();

        return Ok(role);
    }

    [AdminOnly]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRole(int id)
    {
        var role = await _context.Roles.FindAsync(id);

        if (role == null || role.IsDeleted)
            return NotFound("Rol bulunamadı.");

        role.IsDeleted = true;
        role.IsActive = false;

        await _context.SaveChangesAsync();

        return Ok("Rol silindi.");
    }
}