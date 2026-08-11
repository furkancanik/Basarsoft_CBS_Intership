using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

using LoginMapApi.Services.Interfaces;

using NetTopologySuite.Geometries;

namespace LoginMapApi.Services;

public sealed class WalkingRouteService : IWalkingRouteService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<WalkingRouteService> _logger;

    public WalkingRouteService(
        HttpClient httpClient,
        ILogger<WalkingRouteService> logger
    )
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<WalkingRouteResult> CreateWalkingRouteAsync(
        double startLongitude,
        double startLatitude,
        double endLongitude,
        double endLatitude,
        CancellationToken cancellationToken = default
    )
    {
        var culture =
            CultureInfo.InvariantCulture;

        var coordinates =
            $"{startLongitude.ToString(culture)},{startLatitude.ToString(culture)};" +
            $"{endLongitude.ToString(culture)},{endLatitude.ToString(culture)}";

        /*
         * Bu istek artık CAR OSRM'ye değil,
         * localhost:5002 üzerinde çalışan
         * FOOT / PEDESTRIAN OSRM'ye gider.
         *
         * BaseAddress Program.cs içerisinden gelir.
         */
        var url =
            $"route/v1/walking/{coordinates}" +
            "?overview=full" +
            "&geometries=geojson" +
            "&steps=false" +
            "&alternatives=false";

        try
        {
            _logger.LogInformation(
                "Walking route requested: {StartLongitude},{StartLatitude} -> {EndLongitude},{EndLatitude}",
                startLongitude,
                startLatitude,
                endLongitude,
                endLatitude
            );

            using var response =
                await _httpClient.GetAsync(
                    url,
                    cancellationToken
                );

            var responseText =
                await response.Content
                    .ReadAsStringAsync(
                        cancellationToken
                    );

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError(
                    "Walking OSRM error. Status={StatusCode}, Body={Body}",
                    (int)response.StatusCode,
                    responseText
                );

                throw new InvalidOperationException(
                    $"Yaya rota servisi HTTP {(int)response.StatusCode} hatası döndürdü."
                );
            }

            OsrmResponse? body;

            try
            {
                body =
                    JsonSerializer.Deserialize<OsrmResponse>(
                        responseText,
                        new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive =
                                true
                        }
                    );
            }
            catch (JsonException ex)
            {
                _logger.LogError(
                    ex,
                    "Walking OSRM geçerli JSON döndürmedi. Body={Body}",
                    responseText
                );

                throw new InvalidOperationException(
                    "Yaya rota servisinden geçersiz cevap alındı."
                );
            }

            if (body == null)
            {
                throw new InvalidOperationException(
                    "Yaya rota servisinden boş cevap alındı."
                );
            }

            if (
                !string.Equals(
                    body.Code,
                    "Ok",
                    StringComparison.OrdinalIgnoreCase
                )
            )
            {
                throw new InvalidOperationException(
                    !string.IsNullOrWhiteSpace(
                        body.Message
                    )
                        ? body.Message
                        : "Yaya rotası oluşturulamadı."
                );
            }

            var route =
                body.Routes?.FirstOrDefault();

            if (route == null)
            {
                throw new InvalidOperationException(
                    "Yaya rota alternatifi bulunamadı."
                );
            }

            if (
                route.Geometry?.Coordinates == null ||
                route.Geometry.Coordinates.Count < 2
            )
            {
                throw new InvalidOperationException(
                    "Yaya rotası geometrisi alınamadı."
                );
            }

            var coordinatesArray =
                route.Geometry.Coordinates
                    .Where(item =>
                        item != null &&
                        item.Length >= 2
                    )
                    .Select(item =>
                        new Coordinate(
                            item[0],
                            item[1]
                        )
                    )
                    .ToArray();

            if (coordinatesArray.Length < 2)
            {
                throw new InvalidOperationException(
                    "Yaya rotası için yeterli koordinat bulunamadı."
                );
            }

            var geometryFactory =
                new GeometryFactory(
                    new PrecisionModel(),
                    4326
                );

            var line =
                geometryFactory
                    .CreateLineString(
                        coordinatesArray
                    );

            _logger.LogInformation(
                "Walking route created. Distance={DistanceMeters} m, Duration={DurationSeconds} s, PointCount={PointCount}",
                route.Distance,
                route.Duration,
                coordinatesArray.Length
            );

            return new WalkingRouteResult
            {
                Geometry = line,

                DistanceMeters =
                    route.Distance,

                DurationSeconds =
                    route.Duration
            };
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(
                ex,
                "Walking OSRM servisine bağlanılamadı. BaseAddress={BaseAddress}",
                _httpClient.BaseAddress
            );

            throw new InvalidOperationException(
                "Yaya rota servisine bağlanılamadı. localhost:5002 üzerindeki Walking OSRM container'ını kontrol edin.",
                ex
            );
        }
        catch (TaskCanceledException ex)
            when (
                !cancellationToken
                    .IsCancellationRequested
            )
        {
            _logger.LogError(
                ex,
                "Walking OSRM isteği zaman aşımına uğradı."
            );

            throw new InvalidOperationException(
                "Yaya rota servisi zaman aşımına uğradı.",
                ex
            );
        }
    }


    // =====================================================
    // OSRM RESPONSE MODELS
    // =====================================================

    private sealed class OsrmResponse
    {
        [JsonPropertyName("code")]
        public string Code { get; set; } =
            "";

        [JsonPropertyName("message")]
        public string? Message { get; set; }

        [JsonPropertyName("routes")]
        public List<OsrmRoute>? Routes
            { get; set; }
    }


    private sealed class OsrmRoute
    {
        [JsonPropertyName("distance")]
        public double Distance
            { get; set; }

        [JsonPropertyName("duration")]
        public double Duration
            { get; set; }

        [JsonPropertyName("geometry")]
        public GeoJsonLineString? Geometry
            { get; set; }
    }


    private sealed class GeoJsonLineString
    {
        [JsonPropertyName("coordinates")]
        public List<double[]> Coordinates
            { get; set; } = new();
    }
}