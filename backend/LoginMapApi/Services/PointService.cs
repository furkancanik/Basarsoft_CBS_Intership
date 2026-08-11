using LoginMapApi.Data;
using LoginMapApi.Models;
using LoginMapApi.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace LoginMapApi.Services;

public class PointService : IPointService
{
    private readonly AppDbContext _context;

    public PointService(AppDbContext context)
    {
        _context = context;
    }

    public object GetPoints(int userId)
    {
        var writer = new WKTWriter();

        // Önce sorguyu veritabanında çalıştırıp kayıtları belleğe alıyoruz.
        // WKTWriter.Write metodu EF sorgusunun içinde SQL'e çevrilemez.
        var points = _context.Points
            .AsNoTracking()
            .Where(point =>
                point.UserId == userId &&
                point.IsActive &&
                !point.IsDeleted
            )
            .OrderBy(point => point.Id)
            .ToList();

        return points
            .Select(point => new
            {
                point.Id,
                point.Name,
                point.Color,
                point.Description,
                Wkt = writer.Write(point.Geometry),
                point.CreatedDate,
                point.ModifiedDate,
                point.IsActive,
                point.IsDeleted
            })
            .ToList();
    }

    public object AddPoint(GeometryRequest request, int userId)
    {
        if (request == null)
            throw new ArgumentNullException(nameof(request));

        if (string.IsNullOrWhiteSpace(request.Wkt))
            throw new Exception("Geometri bilgisi boş olamaz.");

        var reader = new WKTReader();
        var geometry = reader.Read(request.Wkt);

        if (geometry is not Point pointGeometry)
            throw new Exception("Gönderilen geometri Point tipinde olmalıdır.");

        pointGeometry.SRID = 4326;

        var point = new PointFeature
        {
            Name = request.Name?.Trim() ?? "",
            Color = string.IsNullOrWhiteSpace(request.Color)
                ? "#2563eb"
                : request.Color,
            Description = request.Description?.Trim() ?? "",
            Geometry = pointGeometry,
            UserId = userId,
            IsActive = true,
            IsDeleted = false,
            CreatedDate = DateTime.UtcNow,
            ModifiedDate = null,
            ModifiedUserId = null
        };

        _context.Points.Add(point);
        _context.SaveChanges();

        return new
        {
            point.Id,
            point.Name,
            point.Color,
            point.Description,
            Wkt = new WKTWriter().Write(point.Geometry),
            point.CreatedDate,
            point.ModifiedDate,
            point.IsActive,
            point.IsDeleted
        };
    }

    public bool UpdatePoint(int id, GeometryRequest request, int userId)
    {
        if (request == null)
            throw new ArgumentNullException(nameof(request));

        var point = _context.Points.FirstOrDefault(item =>
            item.Id == id &&
            item.UserId == userId &&
            item.IsActive &&
            !item.IsDeleted
        );

        if (point == null)
            return false;

        if (string.IsNullOrWhiteSpace(request.Wkt))
            throw new Exception("Geometri bilgisi boş olamaz.");

        var reader = new WKTReader();
        var geometry = reader.Read(request.Wkt);

        if (geometry is not Point pointGeometry)
            throw new Exception("Gönderilen geometri Point tipinde olmalıdır.");

        pointGeometry.SRID = 4326;

        point.Name = request.Name?.Trim() ?? "";
        point.Color = string.IsNullOrWhiteSpace(request.Color)
            ? "#2563eb"
            : request.Color;
        point.Description = request.Description?.Trim() ?? "";
        point.Geometry = pointGeometry;
        point.ModifiedDate = DateTime.UtcNow;
        point.ModifiedUserId = userId;

        _context.SaveChanges();

        return true;
    }

    public bool DeletePoint(int id, int userId)
    {
        var point = _context.Points.FirstOrDefault(item =>
            item.Id == id &&
            item.UserId == userId &&
            !item.IsDeleted
        );

        if (point == null)
            return false;

        point.IsDeleted = true;
        point.IsActive = false;
        point.ModifiedDate = DateTime.UtcNow;
        point.ModifiedUserId = userId;

        _context.SaveChanges();

        return true;
    }
}
