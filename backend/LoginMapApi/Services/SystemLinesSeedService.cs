using System.Globalization;
using System.Reflection;
using System.Text;
using System.Text.Json;
using LoginMapApi.Data;
using LoginMapApi.Models;
using LoginMapApi.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using NetTopologySuite.Simplify;

namespace LoginMapApi.Services;

/*
 * Bütün kullanıcıların ortak gördüğü sistem hatlarını yükler
 * (Data/Seed/system-lines.json):
 *
 * - İstanbul metro hatları (İBB Açık Veri Portalı)
 * - Ankara raylı sistem hatları (OpenStreetMap)
 * - Karadeniz, Akdeniz ve İç Anadolu turları (her ilde bir durak;
 *   kara yolu geometrisi açılışta OSRM ile üretilir)
 *
 * Hatlar pasif sistem kullanıcılarına kaydedilir; herkes görür,
 * kimse değiştiremez (bkz. AppDbContext). Her hat için her gün
 * çalışan bir takvim ve iki yönlü seferler oluşturulur, böylece
 * hatlar yol tarifinde kullanılabilir.
 *
 * Uygulama açıldıktan sonra arka planda çalışır; zaten yüklenmiş
 * hatlar atlanır. Bir hat yüklenemezse (ör. OSRM yanıt vermezse)
 * bir sonraki açılışta tekrar denenir.
 */
public class SystemLinesSeedService : BackgroundService
{
    private const double MetroSpeedMetersPerSecond = 35_000.0 / 3600.0;

    // Kara yolu geometrisi sadeleştirme toleransı (derece, ~40 m)
    private const double RoadSimplifyTolerance = 0.0004;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SystemLinesSeedService> _logger;

    public SystemLinesSeedService(
        IServiceScopeFactory scopeFactory,
        ILogger<SystemLinesSeedService> logger
    )
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken
    )
    {
        try
        {
            // Uygulamanın açılışını geciktirmemek için kısa bekleme.
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

            using var scope = _scopeFactory.CreateScope();

            var context = scope.ServiceProvider
                .GetRequiredService<AppDbContext>();

            var osrmService = scope.ServiceProvider
                .GetRequiredService<IOsrmService>();

            await SeedAsync(context, osrmService, stoppingToken);
        }
        catch (OperationCanceledException)
            when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Sistem hatları yüklenirken hata oluştu."
            );
        }
    }

    private async Task SeedAsync(
        AppDbContext context,
        IOsrmService osrmService,
        CancellationToken cancellationToken
    )
    {
        var data = LoadSeedData();

        if (data?.Lines == null || data.Lines.Count == 0)
        {
            _logger.LogWarning("Sistem hatları verisi bulunamadı.");
            return;
        }

        var ownerIds = new Dictionary<string, int>();

        foreach (var username in SystemData.SystemUsernames)
        {
            ownerIds[username] = await EnsureSystemUserAsync(
                context,
                username,
                cancellationToken
            );
        }

        var allOwnerIds = ownerIds.Values.ToList();

        var existing = await context.TransitRoutes
            .IgnoreQueryFilters()
            .Where(route =>
                route.CreatedUserId.HasValue &&
                allOwnerIds.Contains(route.CreatedUserId.Value) &&
                !route.IsDeleted
            )
            .Select(route => new
            {
                OwnerId = route.CreatedUserId!.Value,
                route.ShortCode
            })
            .ToListAsync(cancellationToken);

        foreach (var line in data.Lines)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (!ownerIds.TryGetValue(line.Owner, out var ownerId))
            {
                _logger.LogWarning(
                    "Bilinmeyen sistem hattı sahibi: {Owner}",
                    line.Owner
                );
                continue;
            }

            if (existing.Any(item =>
                    item.OwnerId == ownerId &&
                    item.ShortCode == line.ShortCode))
            {
                continue;
            }

            try
            {
                var geometry = await BuildGeometryAsync(
                    line,
                    osrmService,
                    cancellationToken
                );

                await using var transaction =
                    await context.Database.BeginTransactionAsync(
                        cancellationToken
                    );

                await SeedLineAsync(
                    context,
                    ownerId,
                    line,
                    geometry,
                    cancellationToken
                );

                await transaction.CommitAsync(cancellationToken);

                _logger.LogInformation(
                    "Sistem hattı yüklendi: {ShortCode} ({Name})",
                    line.ShortCode,
                    line.Name
                );
            }
            catch (Exception ex)
                when (ex is not OperationCanceledException)
            {
                _logger.LogError(
                    ex,
                    "Sistem hattı yüklenemedi: {ShortCode}",
                    line.ShortCode
                );
            }
            finally
            {
                context.ChangeTracker.Clear();
            }
        }
    }

    private static async Task<int> EnsureSystemUserAsync(
        AppDbContext context,
        string username,
        CancellationToken cancellationToken
    )
    {
        var user = await context.Users
            .FirstOrDefaultAsync(
                item => item.Username == username,
                cancellationToken
            );

        if (user != null)
        {
            return user.Id;
        }

        user = new User
        {
            Username = username,
            Password = BCrypt.Net.BCrypt.HashPassword(
                Guid.NewGuid().ToString("N")
            ),
            IsActive = false,
            IsDeleted = false,
            CreatedDate = DateTime.UtcNow
        };

        context.Users.Add(user);
        await context.SaveChangesAsync(cancellationToken);

        return user.Id;
    }

    /*
     * Raylı sistemlerde geometri veri dosyasında hazırdır.
     * Bölge turlarında kara yolu geometrisi OSRM'den alınır
     * ve sadeleştirilir.
     */
    private static async Task<(string Wkt, double DistanceMeters)>
        BuildGeometryAsync(
            SeedLine line,
            IOsrmService osrmService,
            CancellationToken cancellationToken
        )
    {
        if (line.Coordinates != null && line.Coordinates.Count >= 2)
        {
            return (
                BuildLineStringWkt(line.Coordinates),
                line.LengthMeters
            );
        }

        var stopPoints = line.Stations
            .Select(station => new Point(station.Lon, station.Lat)
            {
                SRID = 4326
            })
            .ToList();

        var result = await osrmService.CreateRouteAsync(
            stopPoints,
            cancellationToken
        );

        var simplified = DouglasPeuckerSimplifier.Simplify(
            result.Geometry,
            RoadSimplifyTolerance
        );

        return (
            new WKTWriter().Write(simplified),
            result.DistanceMeters
        );
    }

    private static async Task SeedLineAsync(
        AppDbContext context,
        int ownerId,
        SeedLine line,
        (string Wkt, double DistanceMeters) geometry,
        CancellationToken cancellationToken
    )
    {
        var now = DateTime.UtcNow;
        var stations = line.Stations;

        // Durak arası sürüş süreleri (saniye)
        var runSeconds = new List<int>();

        for (var i = 1; i < stations.Count; i++)
        {
            if (stations[i].RunSeconds is > 0)
            {
                runSeconds.Add(stations[i].RunSeconds!.Value);
                continue;
            }

            var meters = Math.Max(
                0,
                stations[i].ChainageM - stations[i - 1].ChainageM
            );

            runSeconds.Add(
                (int)Math.Round(meters / MetroSpeedMetersPerSecond)
            );
        }

        var totalDurationSeconds =
            runSeconds.Sum() +
            line.DwellSeconds * Math.Max(0, stations.Count - 2);

        var route = new TransitRoute
        {
            Name = line.Name,
            ShortCode = line.ShortCode,
            Color = line.Color,
            RouteWkt = geometry.Wkt,
            DistanceMeters = geometry.DistanceMeters,
            DurationSeconds = totalDurationSeconds,
            RouteUpdatedDate = now,
            IsActive = true,
            IsDeleted = false,
            CreatedDate = now,
            CreatedUserId = ownerId
        };

        context.TransitRoutes.Add(route);
        await context.SaveChangesAsync(cancellationToken);

        var stops = stations
            .Select((station, index) => new TransitStop
            {
                Name = station.Name,
                TransitRouteId = route.Id,
                Geometry = new Point(station.Lon, station.Lat)
                {
                    SRID = 4326
                },
                OrderNo = index + 1,
                StopType = line.StopType,
                UserId = ownerId,
                IsActive = true,
                IsDeleted = false,
                CreatedDate = now
            })
            .ToList();

        context.TransitStops.AddRange(stops);

        var schedule = new TransitSchedule
        {
            TransitRouteId = route.Id,
            Name = "Her gün",
            ValidFrom = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            ValidTo = null,
            RunsMonday = true,
            RunsTuesday = true,
            RunsWednesday = true,
            RunsThursday = true,
            RunsFriday = true,
            RunsSaturday = true,
            RunsSunday = true,
            IsActive = true,
            IsDeleted = false,
            CreatedDate = now
        };

        context.TransitSchedules.Add(schedule);
        await context.SaveChangesAsync(cancellationToken);

        var departures = GetDepartureTimes(line);

        // İki yön: G (gidiş, durak sırası) ve D (dönüş, ters sıra)
        var directions = new[]
        {
            (Code: "G", Stops: stops, Runs: runSeconds),
            (
                Code: "D",
                Stops: Enumerable.Reverse(stops).ToList(),
                Runs: Enumerable.Reverse(runSeconds).ToList()
            )
        };

        foreach (var direction in directions)
        {
            foreach (var departure in departures)
            {
                var trip = new TransitTrip
                {
                    TransitRouteId = route.Id,
                    TransitScheduleId = schedule.Id,
                    TripCode =
                        $"SYS-{line.ShortCode}-{direction.Code}-" +
                        departure.ToString("HHmm", CultureInfo.InvariantCulture),
                    VehicleType = line.VehicleType,
                    DepartureTime = departure,
                    IsActive = true,
                    IsDeleted = false,
                    CreatedDate = now
                };

                var offset = 0;

                for (var i = 0; i < direction.Stops.Count; i++)
                {
                    var isFirst = i == 0;
                    var isLast = i == direction.Stops.Count - 1;

                    if (!isFirst)
                    {
                        offset += direction.Runs[i - 1];
                    }

                    var arrival = offset;
                    var dwell = isFirst || isLast ? 0 : line.DwellSeconds;
                    var departureOffset = arrival + dwell;

                    trip.Stops.Add(new TransitTripStop
                    {
                        TransitStopId = direction.Stops[i].Id,
                        StopSequence = i + 1,
                        ArrivalOffsetSeconds = arrival,
                        DepartureOffsetSeconds = departureOffset,
                        DwellSeconds = dwell
                    });

                    offset = departureOffset;
                }

                context.TransitTrips.Add(trip);
            }
        }

        await context.SaveChangesAsync(cancellationToken);
    }

    private static List<TimeOnly> GetDepartureTimes(SeedLine line)
    {
        if (line.Departures != null && line.Departures.Count > 0)
        {
            return line.Departures
                .Select(value => TimeOnly.ParseExact(
                    value,
                    "HH:mm",
                    CultureInfo.InvariantCulture
                ))
                .ToList();
        }

        var first = TimeOnly.ParseExact(
            line.FirstDeparture ?? "06:00",
            "HH:mm",
            CultureInfo.InvariantCulture
        );

        var last = TimeOnly.ParseExact(
            line.LastDeparture ?? "23:45",
            "HH:mm",
            CultureInfo.InvariantCulture
        );

        var headway = Math.Max(5, line.HeadwayMinutes ?? 15);
        var result = new List<TimeOnly>();

        for (
            var minutes = first.Hour * 60 + first.Minute;
            minutes <= last.Hour * 60 + last.Minute;
            minutes += headway
        )
        {
            result.Add(new TimeOnly(minutes / 60, minutes % 60));
        }

        return result;
    }

    private static string BuildLineStringWkt(
        List<double[]> coordinates
    )
    {
        var builder = new StringBuilder("LINESTRING (");

        for (var i = 0; i < coordinates.Count; i++)
        {
            if (i > 0)
            {
                builder.Append(", ");
            }

            builder.Append(
                coordinates[i][0].ToString(CultureInfo.InvariantCulture)
            );
            builder.Append(' ');
            builder.Append(
                coordinates[i][1].ToString(CultureInfo.InvariantCulture)
            );
        }

        builder.Append(')');
        return builder.ToString();
    }

    private static SeedData? LoadSeedData()
    {
        using var stream = Assembly
            .GetExecutingAssembly()
            .GetManifestResourceStream("system-lines.json");

        if (stream == null)
        {
            return null;
        }

        return JsonSerializer.Deserialize<SeedData>(
            stream,
            new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }
        );
    }

    private class SeedData
    {
        public List<string>? Sources { get; set; }
        public List<SeedLine> Lines { get; set; } = new();
    }

    private class SeedLine
    {
        public string Owner { get; set; } = "";
        public string ShortCode { get; set; } = "";
        public string Name { get; set; } = "";
        public string Color { get; set; } = "#2563eb";
        public double LengthMeters { get; set; }
        public string StopType { get; set; } = "Metro";
        public string VehicleType { get; set; } = "Metro";
        public int DwellSeconds { get; set; } = 30;
        public int? HeadwayMinutes { get; set; }
        public string? FirstDeparture { get; set; }
        public string? LastDeparture { get; set; }
        public List<string>? Departures { get; set; }
        public List<SeedStation> Stations { get; set; } = new();
        public List<double[]>? Coordinates { get; set; }
    }

    private class SeedStation
    {
        public string Name { get; set; } = "";
        public double Lon { get; set; }
        public double Lat { get; set; }
        public double ChainageM { get; set; }
        public int? RunSeconds { get; set; }
    }
}
