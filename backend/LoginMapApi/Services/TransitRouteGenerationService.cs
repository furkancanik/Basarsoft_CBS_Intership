using LoginMapApi.Data;
using LoginMapApi.Models;
using LoginMapApi.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.IO;

namespace LoginMapApi.Services;

public class TransitRouteGenerationService :
    ITransitRouteGenerationService
{
    private readonly AppDbContext _context;
    private readonly IOsrmService _osrmService;

    public TransitRouteGenerationService(
        AppDbContext context,
        IOsrmService osrmService
    )
    {
        _context = context;
        _osrmService = osrmService;
    }

    public async Task<TransitRoute> RegenerateRouteAsync(
        int routeId,
        int modifiedUserId,
        CancellationToken cancellationToken = default
    )
    {
        var route = await _context.TransitRoutes
            .Include(item =>
                item.Stops.Where(stop =>
                    stop.IsActive &&
                    !stop.IsDeleted
                )
            )
            .FirstOrDefaultAsync(
                item =>
                    item.Id == routeId &&
                    item.IsActive &&
                    !item.IsDeleted,
                cancellationToken
            );

        if (route == null)
        {
            throw new InvalidOperationException(
                "Güzergah bulunamadı."
            );
        }

        var orderedStops = route.Stops
            .Where(stop =>
                stop.Geometry != null
            )
            .OrderBy(stop => stop.OrderNo)
            .ThenBy(stop => stop.Id)
            .ToList();

        /*
         * 2 aktif duraktan az kaldıysa
         * rota geometrisini temizle.
         */
        if (orderedStops.Count < 2)
        {
            route.RouteWkt = null;
            route.DistanceMeters = null;
            route.DurationSeconds = null;

            route.RouteUpdatedDate =
                DateTime.UtcNow;

            route.ModifiedDate =
                DateTime.UtcNow;

            route.ModifiedUserId =
                modifiedUserId;

            await _context.SaveChangesAsync(
                cancellationToken
            );

            return route;
        }

        /*
         * Aktif durakları mevcut OrderNo
         * sırasına göre OSRM'e gönder.
         */
        var stopPoints = orderedStops
            .Select(stop => stop.Geometry)
            .ToList();

        var osrmResult =
            await _osrmService.CreateRouteAsync(
                stopPoints,
                cancellationToken
            );

        var writer = new WKTWriter();

        route.RouteWkt =
            writer.Write(
                osrmResult.Geometry
            );

        route.DistanceMeters =
            osrmResult.DistanceMeters;

        route.DurationSeconds =
            osrmResult.DurationSeconds;

        route.RouteUpdatedDate =
            DateTime.UtcNow;

        route.ModifiedDate =
            DateTime.UtcNow;

        route.ModifiedUserId =
            modifiedUserId;

        await _context.SaveChangesAsync(
            cancellationToken
        );

        return route;
    }

    /*
     * Şimdilik otomatik geometrik sıralama yapmıyoruz.
     *
     * Durakların mevcut OrderNo değerleri korunur.
     *
     * Bu metodun interface içerisinde kalmasının sebebi,
     * TransitStopsController'ın mevcut yapısını bozmamaktır.
     */
    public Task ReorderStopsByCurrentRouteGeometryAsync(
        int routeId,
        int modifiedUserId,
        CancellationToken cancellationToken = default
    )
    {
        return Task.CompletedTask;
    }
}