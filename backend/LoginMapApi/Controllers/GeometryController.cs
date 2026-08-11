using LoginMapApi.Data;
using LoginMapApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NetTopologySuite.IO;
using System.Security.Claims;

namespace LoginMapApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GeometryController : ControllerBase
{
    private readonly AppDbContext _context;

    public GeometryController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("query")]
    public IActionResult QueryGeometries(
        [FromQuery] string? name,
        [FromQuery] string? type,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? sortBy = "createdDate",
        [FromQuery] string? sortDirection = "desc"
    )
    {
        try
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (userIdClaim == null)
                return Unauthorized();

            var userId = int.Parse(userIdClaim);
            var writer = new WKTWriter();

            var points = _context.Points
                .Where(x => x.UserId == userId && x.IsActive && !x.IsDeleted)
                .AsEnumerable()
                .Select(x => new GeometryDto
                {
                    Id = x.Id,
                    Name = x.Name,
                    Type = "Point",
                    Color = x.Color,
                    Description = x.Description,
                    CreatedDate = x.CreatedDate,
                    Wkt = writer.Write(x.Geometry)
                })
                .ToList();

            var lines = _context.Lines
                .Where(x => x.UserId == userId && x.IsActive && !x.IsDeleted)
                .AsEnumerable()
                .Select(x => new GeometryDto
                {
                    Id = x.Id,
                    Name = x.Name,
                    Type = "Line",
                    Color = x.Color,
                    Description = x.Description,
                    CreatedDate = x.CreatedDate,
                    Wkt = writer.Write(x.Geometry)
                })
                .ToList();

            var polygons = _context.Polygons
                .Where(x => x.UserId == userId && x.IsActive && !x.IsDeleted)
                .AsEnumerable()
                .Select(x => new GeometryDto
                {
                    Id = x.Id,
                    Name = x.Name,
                    Type = "Polygon",
                    Color = x.Color,
                    Description = x.Description,
                    CreatedDate = x.CreatedDate,
                    Wkt = writer.Write(x.Geometry)
                })
                .ToList();

            var query = points
                .Concat(lines)
                .Concat(polygons)
                .AsEnumerable();

            if (!string.IsNullOrWhiteSpace(name))
            {
                query = query.Where(x =>
                    x.Name.ToLower().Contains(name.ToLower())
                );
            }

            if (!string.IsNullOrWhiteSpace(type) && type != "All")
            {
                query = query.Where(x => x.Type == type);
            }

            if (startDate.HasValue)
            {
                query = query.Where(x =>
                    x.CreatedDate.Date >= startDate.Value.Date
                );
            }

            if (endDate.HasValue)
            {
                query = query.Where(x =>
                    x.CreatedDate.Date <= endDate.Value.Date
                );
            }

            query = sortBy switch
            {
                "name" => sortDirection == "asc"
                    ? query.OrderBy(x => x.Name)
                    : query.OrderByDescending(x => x.Name),

                "type" => sortDirection == "asc"
                    ? query.OrderBy(x => x.Type)
                    : query.OrderByDescending(x => x.Type),

                "createdDate" => sortDirection == "asc"
                    ? query.OrderBy(x => x.CreatedDate)
                    : query.OrderByDescending(x => x.CreatedDate),

                _ => query.OrderByDescending(x => x.CreatedDate)
            };

            return Ok(query.ToList());
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Geometriler sorgulanırken hata oluştu.",
                error = ex.Message
            });
        }
    }
}