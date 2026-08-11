using System.Globalization;
using System.Text.Json;
using LoginMapApi.Services.Interfaces;
using NetTopologySuite.Geometries;

namespace LoginMapApi.Services;

public class OsrmService : IOsrmService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<OsrmService> _logger;

    public OsrmService(
        HttpClient httpClient,
        ILogger<OsrmService> logger
    )
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<OsrmRouteResult> CreateRouteAsync(
        IReadOnlyCollection<Point> orderedStops,
        CancellationToken cancellationToken = default
    )
    {
        if (orderedStops == null || orderedStops.Count < 2)
        {
            throw new InvalidOperationException(
                "Rota oluşturmak için en az iki aktif durak gereklidir."
            );
        }

        var coordinates = string.Join(
            ";",
            orderedStops.Select(point =>
                string.Create(
                    CultureInfo.InvariantCulture,
                    $"{point.X},{point.Y}"
                )
            )
        );

        var requestUrl =
            $"route/v1/driving/{coordinates}" +
            "?overview=full" +
            "&geometries=geojson" +
            "&steps=false" +
            "&alternatives=false";

        HttpResponseMessage response;

        try
        {
            response = await _httpClient.GetAsync(
                requestUrl,
                cancellationToken
            );
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(
                ex,
                "Local OSRM servisine bağlanılamadı."
            );

            throw new InvalidOperationException(
                "Local OSRM servisine bağlanılamadı. Docker container çalışıyor mu kontrol edin.",
                ex
            );
        }

        var responseText = await response.Content.ReadAsStringAsync(
            cancellationToken
        );

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError(
                "OSRM başarısız cevap verdi. Status: {StatusCode}, Body: {Body}",
                response.StatusCode,
                responseText
            );

            throw new InvalidOperationException(
                $"OSRM rota isteği başarısız oldu: {(int)response.StatusCode}"
            );
        }

        using var document = JsonDocument.Parse(responseText);

        var root = document.RootElement;

        var code = root.TryGetProperty(
            "code",
            out var codeElement
        )
            ? codeElement.GetString()
            : null;

        if (!string.Equals(
                code,
                "Ok",
                StringComparison.OrdinalIgnoreCase
            ))
        {
            var message = root.TryGetProperty(
                "message",
                out var messageElement
            )
                ? messageElement.GetString()
                : "OSRM rota oluşturamadı.";

            throw new InvalidOperationException(
                message ?? "OSRM rota oluşturamadı."
            );
        }

        if (!root.TryGetProperty(
                "routes",
                out var routesElement
            ) ||
            routesElement.GetArrayLength() == 0)
        {
            throw new InvalidOperationException(
                "OSRM geçerli bir rota döndürmedi."
            );
        }

        var firstRoute = routesElement[0];

        var distance = firstRoute
            .GetProperty("distance")
            .GetDouble();

        var duration = firstRoute
            .GetProperty("duration")
            .GetDouble();

        var geometryElement = firstRoute
            .GetProperty("geometry");

        var geometryType = geometryElement
            .GetProperty("type")
            .GetString();

        if (!string.Equals(
                geometryType,
                "LineString",
                StringComparison.OrdinalIgnoreCase
            ))
        {
            throw new InvalidOperationException(
                "OSRM tarafından LineString geometrisi döndürülmedi."
            );
        }

        var coordinateElements = geometryElement
            .GetProperty("coordinates");

        var coordinatesList = new List<Coordinate>();

        foreach (var coordinateElement in coordinateElements.EnumerateArray())
        {
            if (coordinateElement.GetArrayLength() < 2)
            {
                continue;
            }

            var longitude = coordinateElement[0].GetDouble();
            var latitude = coordinateElement[1].GetDouble();

            coordinatesList.Add(
                new Coordinate(longitude, latitude)
            );
        }

        if (coordinatesList.Count < 2)
        {
            throw new InvalidOperationException(
                "OSRM yeterli rota koordinatı döndürmedi."
            );
        }

        var geometryFactory = new GeometryFactory(
            new PrecisionModel(),
            4326
        );

        var lineString = geometryFactory.CreateLineString(
            coordinatesList.ToArray()
        );

        lineString.SRID = 4326;

        return new OsrmRouteResult
        {
            Geometry = lineString,
            DistanceMeters = distance,
            DurationSeconds = duration
        };
    }
}