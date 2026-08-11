using LoginMapApi.Data;
using LoginMapApi.Models;
using LoginMapApi.Services.Interfaces;
using NetTopologySuite.IO;

namespace LoginMapApi.Services;

public class GeometryQueryService : IGeometryQueryService
{
    private readonly AppDbContext _context;

    public GeometryQueryService(AppDbContext context)
    {
        _context = context;
    }

    public object Search(GeometryQueryRequest request, int userId)
    {
        var writer = new WKTWriter();

        var points = _context.Points
            .Where(p =>
                p.UserId == userId &&
                p.IsActive == true &&
                p.IsDeleted == false
            )
            .Select(p => new GeometryListItem
            {
                Id = p.Id,
                Type = "Point",
                Name = p.Name,
                Color = p.Color,
                Wkt = writer.Write(p.Geometry),
                CreatedDate = p.CreatedDate
            })
            .ToList();

        var lines = _context.Lines
            .Where(l =>
                l.UserId == userId &&
                l.IsActive == true &&
                l.IsDeleted == false
            )
            .Select(l => new GeometryListItem
            {
                Id = l.Id,
                Type = "Line",
                Name = l.Name,
                Color = l.Color,
                Wkt = writer.Write(l.Geometry),
                CreatedDate = l.CreatedDate
            })
            .ToList();

        var polygons = _context.Polygons
            .Where(p =>
                p.UserId == userId &&
                p.IsActive == true &&
                p.IsDeleted == false
            )
            .Select(p => new GeometryListItem
            {
                Id = p.Id,
                Type = "Polygon",
                Name = p.Name,
                Color = p.Color,
                Wkt = writer.Write(p.Geometry),
                CreatedDate = p.CreatedDate
            })
            .ToList();

        var query = points
            .Concat(lines)
            .Concat(polygons)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            query = query.Where(x =>
                x.Name.ToLower().Contains(request.Name.ToLower())
            );
        }

        if (!string.IsNullOrWhiteSpace(request.Type) && request.Type != "All")
        {
            query = query.Where(x => x.Type == request.Type);
        }

        if (request.StartDate.HasValue)
        {
            query = query.Where(x => x.CreatedDate.Date >= request.StartDate.Value.Date);
        }

        if (request.EndDate.HasValue)
        {
            query = query.Where(x => x.CreatedDate.Date <= request.EndDate.Value.Date);
        }

        query = request.SortBy switch
        {
            "Name" => request.Desc
                ? query.OrderByDescending(x => x.Name)
                : query.OrderBy(x => x.Name),

            "Type" => request.Desc
                ? query.OrderByDescending(x => x.Type)
                : query.OrderBy(x => x.Type),

            _ => request.Desc
                ? query.OrderByDescending(x => x.CreatedDate)
                : query.OrderBy(x => x.CreatedDate)
        };

        return query.ToList();
    }
}