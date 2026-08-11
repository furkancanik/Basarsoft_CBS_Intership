using LoginMapApi.Data;
using LoginMapApi.Models;
using LoginMapApi.Services.Interfaces;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace LoginMapApi.Services;

public class PolygonService : IPolygonService
{
    private readonly AppDbContext _context;

    public PolygonService(AppDbContext context)
    {
        _context = context;
    }

    public object GetPolygons(int userId)
    {
        var writer = new WKTWriter();

        return _context.Polygons
            .Where(p =>
                p.UserId == userId &&
                p.IsActive == true &&
                p.IsDeleted == false
            )
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Color,
                p.Description,
                Wkt = writer.Write(p.Geometry),
                p.CreatedDate,
                p.ModifiedDate,
                p.IsActive,
                p.IsDeleted
            })
            .ToList();
    }

    public object AddPolygon(GeometryRequest request, int userId)
    {
        var reader = new WKTReader();

        var geometry = reader.Read(request.Wkt);
        geometry.SRID = 4326;

        var polygonGeometry = (Polygon)geometry;

        var polygon = new PolygonFeature
        {
            Name = request.Name,
            Color = request.Color,
            Description = request.Description,
            Geometry = polygonGeometry,

            UserId = userId,
            IsActive = true,
            IsDeleted = false,
            CreatedDate = DateTime.UtcNow,
            ModifiedDate = null,
            ModifiedUserId = null
        };

        _context.Polygons.Add(polygon);
        _context.SaveChanges();

        var inventoryCount = _context.Points
            .Where(p =>
                p.UserId == userId &&
                p.IsActive == true &&
                p.IsDeleted == false
            )
            .Count(p => polygonGeometry.Contains(p.Geometry));

        return new
        {
            polygon.Id,
            polygon.Name,
            polygon.Color,
            polygon.Description,
            Wkt = request.Wkt,
            polygon.CreatedDate,
            polygon.ModifiedDate,
            polygon.IsActive,
            polygon.IsDeleted,
            InventoryCount = inventoryCount
        };
    }

    public bool UpdatePolygon(int id, GeometryRequest request, int userId)
    {
        var polygon = _context.Polygons.FirstOrDefault(p =>
            p.Id == id &&
            p.UserId == userId &&
            p.IsDeleted == false
        );

        if (polygon == null)
            return false;

        var reader = new WKTReader();

        var geometry = reader.Read(request.Wkt);
        geometry.SRID = 4326;

        polygon.Name = request.Name;
        polygon.Color = request.Color;
        polygon.Description = request.Description;
        polygon.Geometry = (Polygon)geometry;

        polygon.ModifiedDate = DateTime.UtcNow;
        polygon.ModifiedUserId = userId;

        _context.SaveChanges();

        return true;
    }

    public bool DeletePolygon(int id, int userId)
    {
        var polygon = _context.Polygons.FirstOrDefault(p =>
            p.Id == id &&
            p.UserId == userId &&
            p.IsDeleted == false
        );

        if (polygon == null)
            return false;

        polygon.IsDeleted = true;
        polygon.IsActive = false;
        polygon.ModifiedDate = DateTime.UtcNow;
        polygon.ModifiedUserId = userId;

        _context.SaveChanges();

        return true;
    }
}