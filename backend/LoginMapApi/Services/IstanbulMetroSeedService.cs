using System.Globalization;
using System.Reflection;
using System.Text;
using System.Text.Json;
using LoginMapApi.Data;
using LoginMapApi.Models;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace LoginMapApi.Services;

/*
 * İstanbul metro hatlarını (İBB Açık Veri Portalı) veritabanına yükler.
 *
 * - Uygulama açıldıktan sonra arka planda bir kez çalışır.
 * - Hatlar pasif "istanbul_metro" sistem kullanıcısına kaydedilir;
 *   herkes görür, kimse değiştiremez (bkz. AppDbContext).
 * - Her hat için her gün çalışan bir takvim ve iki yönde
 *   06:00 - 23:45 arası 15 dakikada bir sefer oluşturulur;
 *   böylece hatlar yol tarifinde kullanılabilir.
 * - Zaten yüklenmiş hatlar atlanır (idempotent).
 */
public class IstanbulMetroSeedService : BackgroundService
{
    private const double AverageSpeedMetersPerSecond = 35_000.0 / 3600.0;
    private const int StopDwellSeconds = 30;
    private const int HeadwayMinutes = 15;
    private static readonly TimeOnly FirstDeparture = new(6, 0);
    private static readonly TimeOnly LastDeparture = new(23, 45);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<IstanbulMetroSeedService> _logger;

    public IstanbulMetroSeedService(
        IServiceScopeFactory scopeFactory,
        ILogger<IstanbulMetroSeedService> logger
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

            await SeedAsync(context, stoppingToken);
        }
        catch (OperationCanceledException)
            when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "İstanbul metro hatları yüklenirken hata oluştu."
            );
        }
    }

    private async Task SeedAsync(
        AppDbContext context,
        CancellationToken cancellationToken
    )
    {
        var data = LoadSeedData();

        if (data?.Lines == null || data.Lines.Count == 0)
        {
            _logger.LogWarning("İstanbul metro verisi bulunamadı.");
            return;
        }

        var systemUser = await context.Users
            .FirstOrDefaultAsync(
                user => user.Username == SystemData.IstanbulMetroUsername,
                cancellationToken
            );

        if (systemUser == null)
        {
            systemUser = new User
            {
                Username = SystemData.IstanbulMetroUsername,
                Password = BCrypt.Net.BCrypt.HashPassword(
                    Guid.NewGuid().ToString("N")
                ),
                IsActive = false,
                IsDeleted = false,
                CreatedDate = DateTime.UtcNow
            };

            context.Users.Add(systemUser);
            await context.SaveChangesAsync(cancellationToken);
        }

        var existingCodes = await context.TransitRoutes
            .IgnoreQueryFilters()
            .Where(route =>
                route.CreatedUserId == systemUser.Id &&
                !route.IsDeleted
            )
            .Select(route => route.ShortCode)
            .ToListAsync(cancellationToken);

        foreach (var line in data.Lines)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (existingCodes.Contains(line.ShortCode))
            {
                continue;
            }

            await using var transaction =
                await context.Database.BeginTransactionAsync(
                    cancellationToken
                );

            await SeedLineAsync(
                context,
                systemUser.Id,
                line,
                cancellationToken
            );

            await transaction.CommitAsync(cancellationToken);
            context.ChangeTracker.Clear();

            _logger.LogInformation(
                "İstanbul metro hattı yüklendi: {ShortCode}",
                line.ShortCode
            );
        }
    }

    private static async Task SeedLineAsync(
        AppDbContext context,
        int systemUserId,
        MetroLine line,
        CancellationToken cancellationToken
    )
    {
        var now = DateTime.UtcNow;
        var stations = line.Stations;

        // Durak arası koşu süreleri (saniye)
        var runSeconds = new List<int>();
        for (var i = 1; i < stations.Count; i++)
        {
            var meters = Math.Max(
                0,
                stations[i].ChainageM - stations[i - 1].ChainageM
            );

            runSeconds.Add(
                (int)Math.Round(meters / AverageSpeedMetersPerSecond)
            );
        }

        var totalDurationSeconds =
            runSeconds.Sum() +
            StopDwellSeconds * Math.Max(0, stations.Count - 2);

        var route = new TransitRoute
        {
            Name = line.Name,
            ShortCode = line.ShortCode,
            Color = line.Color,
            RouteWkt = BuildLineStringWkt(line.Coordinates),
            DistanceMeters = line.LengthMeters,
            DurationSeconds = totalDurationSeconds,
            RouteUpdatedDate = now,
            IsActive = true,
            IsDeleted = false,
            CreatedDate = now,
            CreatedUserId = systemUserId
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
                StopType = "Metro",
                UserId = systemUserId,
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

        // İki yön: G (gidiş, istasyon sırası) ve D (dönüş, ters sıra)
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
            for (
                var departure = FirstDeparture;
                departure <= LastDeparture;
                departure = departure.AddMinutes(HeadwayMinutes)
            )
            {
                var trip = new TransitTrip
                {
                    TransitRouteId = route.Id,
                    TransitScheduleId = schedule.Id,
                    TripCode =
                        $"IST-{line.ShortCode}-{direction.Code}-" +
                        departure.ToString("HHmm", CultureInfo.InvariantCulture),
                    VehicleType = "Metro",
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
                    var dwell = isFirst || isLast ? 0 : StopDwellSeconds;
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

                // 23:45'ten sonra AddMinutes gün başına döner; döngüyü kır.
                if (departure.AddMinutes(HeadwayMinutes) < departure)
                {
                    break;
                }
            }
        }

        await context.SaveChangesAsync(cancellationToken);
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

    private static MetroSeedData? LoadSeedData()
    {
        using var stream = Assembly
            .GetExecutingAssembly()
            .GetManifestResourceStream("istanbul-metro.json");

        if (stream == null)
        {
            return null;
        }

        return JsonSerializer.Deserialize<MetroSeedData>(
            stream,
            new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }
        );
    }

    private class MetroSeedData
    {
        public string? Source { get; set; }
        public List<MetroLine> Lines { get; set; } = new();
    }

    private class MetroLine
    {
        public string ShortCode { get; set; } = "";
        public string Name { get; set; } = "";
        public string Color { get; set; } = "#2563eb";
        public double LengthMeters { get; set; }
        public List<MetroStation> Stations { get; set; } = new();
        public List<double[]> Coordinates { get; set; } = new();
    }

    private class MetroStation
    {
        public string Name { get; set; } = "";
        public double Lon { get; set; }
        public double Lat { get; set; }
        public double ChainageM { get; set; }
    }
}
