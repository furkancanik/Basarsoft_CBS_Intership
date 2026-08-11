using NetTopologySuite.Geometries;

namespace LoginMapApi.Services.Interfaces;

public class OsrmRouteResult
{
    public LineString Geometry { get; set; } = null!;

    public double DistanceMeters { get; set; }

    public double DurationSeconds { get; set; }
}

public interface IOsrmService
{
    Task<OsrmRouteResult> CreateRouteAsync(
        IReadOnlyCollection<Point> orderedStops,
        CancellationToken cancellationToken = default
    );
}