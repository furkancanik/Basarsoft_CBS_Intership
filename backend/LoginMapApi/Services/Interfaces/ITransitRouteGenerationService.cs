using LoginMapApi.Models;

namespace LoginMapApi.Services.Interfaces;

public interface ITransitRouteGenerationService
{
    /// <summary>
    /// Güzergahın aktif duraklarını OrderNo sırasına göre
    /// local OSRM servisine gönderir ve RouteWkt bilgisini günceller.
    ///
    /// İki aktif duraktan az varsa mevcut rota geometrisini temizler.
    /// </summary>
    Task<TransitRoute> RegenerateRouteAsync(
        int routeId,
        int modifiedUserId,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Mevcut RouteWkt geometrisini referans alarak aktif durakların
    /// OrderNo değerlerini rota üzerindeki konumlarına göre yeniden sıralar.
    ///
    /// RouteWkt yoksa mevcut OrderNo sırası korunur.
    /// </summary>
    Task ReorderStopsByCurrentRouteGeometryAsync(
        int routeId,
        int modifiedUserId,
        CancellationToken cancellationToken = default
    );
}
