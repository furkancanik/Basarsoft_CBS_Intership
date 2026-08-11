using LoginMapApi.Data;
using LoginMapApi.Models;
using LoginMapApi.Services.Interfaces;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace LoginMapApi.Services;

public class LineService : ILineService
{
    private readonly AppDbContext _context;

    public LineService(AppDbContext context)
    {
        _context = context;
    }

    public object GetLines(int userId)
    {
        var writer = new WKTWriter();

        return _context.Lines
            .Where(l =>
                l.UserId == userId &&
                l.IsActive == true &&
                l.IsDeleted == false
            )
            .Select(l => new
            {
                l.Id,
                l.Name,
                l.Color,
                l.Description,
                Wkt = writer.Write(l.Geometry),
                l.CreatedDate,
                l.ModifiedDate,
                l.IsActive,
                l.IsDeleted
            })
            .ToList();
    }

    public object AddLine(GeometryRequest request, int userId)
    {
        var reader = new WKTReader();

        var geometry = reader.Read(request.Wkt);
        geometry.SRID = 4326;

        var line = new LineFeature
        {
            Name = request.Name,
            Color = request.Color,
            Description = request.Description,
            Geometry = (LineString)geometry,

            UserId = userId,
            IsActive = true,
            IsDeleted = false,
            CreatedDate = DateTime.UtcNow,
            ModifiedDate = null,
            ModifiedUserId = null
        };

        _context.Lines.Add(line);
        _context.SaveChanges();

        return new
        {
            line.Id,
            line.Name,
            line.Color,
            line.Description,
            Wkt = request.Wkt,
            line.CreatedDate,
            line.ModifiedDate,
            line.IsActive,
            line.IsDeleted
        };
    }

    public bool UpdateLine(int id, GeometryRequest request, int userId)
    {
        var line = _context.Lines.FirstOrDefault(l =>
            l.Id == id &&
            l.UserId == userId &&
            l.IsDeleted == false
        );

        if (line == null)
            return false;

        var reader = new WKTReader();

        var geometry = reader.Read(request.Wkt);
        geometry.SRID = 4326;

        line.Name = request.Name;
        line.Color = request.Color;
        line.Description = request.Description;
        line.Geometry = (LineString)geometry;

        line.ModifiedDate = DateTime.UtcNow;
        line.ModifiedUserId = userId;

        _context.SaveChanges();

        return true;
    }

    public bool DeleteLine(int id, int userId)
    {
        var line = _context.Lines.FirstOrDefault(l =>
            l.Id == id &&
            l.UserId == userId &&
            l.IsDeleted == false
        );

        if (line == null)
            return false;

        line.IsDeleted = true;
        line.IsActive = false;
        line.ModifiedDate = DateTime.UtcNow;
        line.ModifiedUserId = userId;

        _context.SaveChanges();

        return true;
    }
}