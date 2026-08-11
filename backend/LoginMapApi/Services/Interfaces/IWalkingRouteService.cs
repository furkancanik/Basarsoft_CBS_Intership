using NetTopologySuite.Geometries;

namespace LoginMapApi.Services.Interfaces;

public sealed class WalkingRouteResult
{
    public LineString Geometry { get; set; } = null!;
    public double DistanceMeters { get; set; }
    public double DurationSeconds { get; set; }
}

public interface IWalkingRouteService
{
    Task<WalkingRouteResult> CreateWalkingRouteAsync(
        double startLongitude,
        double startLatitude,
        double endLongitude,
        double endLatitude,
        CancellationToken cancellationToken = default
    );
}
