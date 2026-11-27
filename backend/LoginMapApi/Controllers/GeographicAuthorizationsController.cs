using LoginMapApi.Data;
using LoginMapApi.Models;
using LoginMapApi.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.IO;
using System.Security.Claims;

namespace LoginMapApi.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class GeographicAuthorizationsController : ControllerBase
{
    private readonly AppDbContext _context;

    public GeographicAuthorizationsController(AppDbContext context)
    {
        _context = context;
    }

    [AdminOnly]
    [HttpGet]
    public IActionResult GetAll()
    {
        var writer = new WKTWriter();

        var items = _context.GeographicAuthorizations
            .Include(x => x.User)
            .Include(x => x.Role)
            .Where(x => x.IsActive && !x.IsDeleted)
            .ToList();

        var data = items.Select(x => new
        {
            x.Id,
            x.UserId,
            Username = x.User != null ? x.User.Username : null,
            x.RoleId,
            RoleName = x.Role != null ? x.Role.Name : null,
            Wkt = writer.Write(x.Geometry),
            x.CreatedDate
        }).ToList();

        return Ok(data);
    }

    [AdminOnly]
    [HttpPost]
    public IActionResult Create([FromBody] GeographicAuthorizationRequest request)
    {
        if (request.UserId == null && request.RoleId == null)
            return BadRequest("Kullanıcı veya rol seçilmelidir.");

        if (request.UserId != null && request.RoleId != null)
            return BadRequest("Aynı anda hem kullanıcı hem rol seçilemez.");

        var reader = new WKTReader();
        var geometry = reader.Read(request.Wkt);
        geometry.SRID = 4326;

        var auth = new GeographicAuthorization
        {
            UserId = request.UserId,
            RoleId = request.RoleId,
            Geometry = geometry,
            IsActive = true,
            IsDeleted = false,
            CreatedDate = DateTime.UtcNow
        };

        _context.GeographicAuthorizations.Add(auth);
        _context.SaveChanges();

        return Ok(new { auth.Id });
    }

    [HttpGet("my-areas")]
    public IActionResult GetMyAreas()
    {
        var userId = GetUserId();

        if (userId == null)
            return Unauthorized();

        var userRoleIds = _context.UserRoles
            .Where(x => x.UserId == userId.Value)
            .Select(x => x.RoleId)
            .ToList();

        var writer = new WKTWriter();

        var items = _context.GeographicAuthorizations
            .Where(x =>
                x.IsActive &&
                !x.IsDeleted &&
                (
                    x.UserId == userId.Value ||
                    (x.RoleId != null && userRoleIds.Contains(x.RoleId.Value))
                )
            )
            .ToList();

        var areas = items.Select(x => new
        {
            x.Id,
            Wkt = writer.Write(x.Geometry),
            x.UserId,
            x.RoleId
        }).ToList();

        return Ok(areas);
    }

    [AdminOnly]
    [HttpDelete("{id}")]
    public IActionResult Delete(int id)
    {
        var item = _context.GeographicAuthorizations.FirstOrDefault(x => x.Id == id);

        if (item == null)
            return NotFound();

        item.IsDeleted = true;
        item.IsActive = false;

        _context.SaveChanges();

        return Ok();
    }

    private int? GetUserId()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(value, out var id) ? id : null;
    }
}

public class GeographicAuthorizationRequest
{
    public int? UserId { get; set; }

    public int? RoleId { get; set; }

    public string Wkt { get; set; } = "";
}