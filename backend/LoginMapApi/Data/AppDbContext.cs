using LoginMapApi.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace LoginMapApi.Data;

public class AppDbContext : DbContext
{
    private readonly IHttpContextAccessor? _httpContextAccessor;

    public AppDbContext(
        DbContextOptions<AppDbContext> options,
        IHttpContextAccessor? httpContextAccessor = null
    )
        : base(options)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    /*
     * Veri izolasyonu için giriş yapan kullanıcının ID'si.
     *
     * - HTTP isteği yoksa (arka plan servisleri, araç simülasyonu,
     *   migration) null döner ve filtre uygulanmaz.
     * - HTTP isteği varsa ama kullanıcı giriş yapmamışsa -1 döner;
     *   böylece anonim istekler hiçbir kullanıcı verisini göremez.
     */
    public int? CurrentUserId
    {
        get
        {
            var httpContext = _httpContextAccessor?.HttpContext;

            if (httpContext == null)
            {
                return null;
            }

            var claim = httpContext.User?
                .FindFirst(ClaimTypes.NameIdentifier)?
                .Value;

            return int.TryParse(claim, out var userId)
                ? userId
                : -1;
        }
    }

    // =====================================================
    // SİSTEM VERİSİ KORUMASI
    //
    // İstanbul metro hatları herkese görünür ama HTTP isteğiyle
    // (yani bir kullanıcı tarafından) değiştirilemez.
    // Arka plan servisleri (veri yükleyici) etkilenmez.
    // =====================================================

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        GuardSystemData();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default
    )
    {
        GuardSystemData();
        return base.SaveChangesAsync(
            acceptAllChangesOnSuccess,
            cancellationToken
        );
    }

    private void GuardSystemData()
    {
        if (CurrentUserId == null)
        {
            return;
        }

        var changed = ChangeTracker.Entries()
            .Where(entry =>
                entry.State == EntityState.Added ||
                entry.State == EntityState.Modified ||
                entry.State == EntityState.Deleted
            )
            .ToList();

        var routeIds = new HashSet<int>();
        var stopIds = new HashSet<int>();
        var tripIds = new HashSet<int>();
        var systemUserReferenced = new List<int>();

        foreach (var entry in changed)
        {
            switch (entry.Entity)
            {
                case TransitRoute route:
                    if (route.Id > 0) routeIds.Add(route.Id);
                    if (route.CreatedUserId.HasValue)
                        systemUserReferenced.Add(route.CreatedUserId.Value);
                    break;

                case TransitStop stop:
                    if (stop.Id > 0) stopIds.Add(stop.Id);
                    routeIds.Add(stop.TransitRouteId);
                    systemUserReferenced.Add(stop.UserId);
                    break;

                case TransitSchedule schedule:
                    routeIds.Add(schedule.TransitRouteId);
                    break;

                case TransitTrip trip:
                    routeIds.Add(trip.TransitRouteId);
                    break;

                case TransitTripStop tripStop:
                    tripIds.Add(tripStop.TransitTripId);
                    stopIds.Add(tripStop.TransitStopId);
                    break;
            }
        }

        if (routeIds.Count == 0 &&
            stopIds.Count == 0 &&
            tripIds.Count == 0 &&
            systemUserReferenced.Count == 0)
        {
            return;
        }

        var systemUserId = Users
            .AsNoTracking()
            .Where(user =>
                user.Username == SystemData.IstanbulMetroUsername
            )
            .Select(user => (int?)user.Id)
            .FirstOrDefault();

        if (systemUserId == null)
        {
            return;
        }

        var touchesSystemData =
            systemUserReferenced.Contains(systemUserId.Value) ||
            (routeIds.Count > 0 &&
                TransitRoutes
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Any(route =>
                        routeIds.Contains(route.Id) &&
                        route.CreatedUserId == systemUserId
                    )) ||
            (stopIds.Count > 0 &&
                TransitStops
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Any(stop =>
                        stopIds.Contains(stop.Id) &&
                        stop.UserId == systemUserId
                    )) ||
            (tripIds.Count > 0 &&
                TransitTrips
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Any(trip =>
                        tripIds.Contains(trip.Id) &&
                        trip.TransitRoute != null &&
                        trip.TransitRoute.CreatedUserId == systemUserId
                    ));

        if (touchesSystemData)
        {
            throw new InvalidOperationException(
                "İstanbul metro hatları sistem tarafından sağlanır ve değiştirilemez."
            );
        }
    }

    public DbSet<User> Users { get; set; }
    public DbSet<PointFeature> Points { get; set; }
    public DbSet<LineFeature> Lines { get; set; }
    public DbSet<PolygonFeature> Polygons { get; set; }
    public DbSet<Role> Roles { get; set; }
    public DbSet<Permission> Permissions { get; set; }
    public DbSet<UserRole> UserRoles { get; set; }
    public DbSet<RolePermission> RolePermissions { get; set; }
    public DbSet<UserPermission> UserPermissions { get; set; }
    public DbSet<GeographicAuthorization> GeographicAuthorizations { get; set; }
    public DbSet<Poi> Pois { get; set; }
    public DbSet<PoiCategory> PoiCategories { get; set; }

    public DbSet<TransitRoute> TransitRoutes { get; set; }
    public DbSet<TransitStop> TransitStops { get; set; }
    public DbSet<TransitSchedule> TransitSchedules { get; set; }
    public DbSet<TransitTrip> TransitTrips { get; set; }
    public DbSet<TransitTripStop> TransitTripStops { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<PoiCategory>()
            .HasOne(category => category.Parent)
            .WithMany(category => category.Children)
            .HasForeignKey(category => category.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Poi>()
            .HasOne(poi => poi.PoiCategory)
            .WithMany(category => category.Pois)
            .HasForeignKey(poi => poi.PoiCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Poi>()
            .HasOne(poi => poi.User)
            .WithMany()
            .HasForeignKey(poi => poi.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Poi>()
            .Property(poi => poi.Geometry)
            .HasColumnType("geometry(Point,4326)");

        modelBuilder.Entity<TransitRoute>()
            .Property(route => route.Name)
            .IsRequired()
            .HasMaxLength(150);

        modelBuilder.Entity<TransitRoute>()
            .Property(route => route.ShortCode)
            .IsRequired()
            .HasMaxLength(10);

        modelBuilder.Entity<TransitRoute>()
            .Property(route => route.Color)
            .IsRequired()
            .HasMaxLength(20);

        modelBuilder.Entity<TransitRoute>()
            .Property(route => route.RouteWkt)
            .HasColumnType("text");

        modelBuilder.Entity<TransitRoute>()
            .HasOne(route => route.CreatedUser)
            .WithMany()
            .HasForeignKey(route => route.CreatedUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TransitRoute>()
            .HasIndex(route => route.Name);

        modelBuilder.Entity<TransitRoute>()
            .HasIndex(route => route.ShortCode);

        modelBuilder.Entity<TransitStop>()
            .Property(stop => stop.Name)
            .IsRequired()
            .HasMaxLength(150);

        modelBuilder.Entity<TransitStop>()
            .Property(stop => stop.StopType)
            .IsRequired()
            .HasMaxLength(20)
            .HasDefaultValue("Bus");

        modelBuilder.Entity<TransitStop>()
            .Property(stop => stop.Geometry)
            .HasColumnType("geometry(Point,4326)");

        modelBuilder.Entity<TransitStop>()
            .HasOne(stop => stop.TransitRoute)
            .WithMany(route => route.Stops)
            .HasForeignKey(stop => stop.TransitRouteId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TransitStop>()
            .HasOne(stop => stop.User)
            .WithMany()
            .HasForeignKey(stop => stop.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TransitStop>()
            .HasIndex(stop => stop.TransitRouteId);

        modelBuilder.Entity<TransitStop>()
            .HasIndex(stop => new { stop.TransitRouteId, stop.OrderNo });

        modelBuilder.Entity<TransitStop>()
            .HasIndex(stop => stop.StopType);

        modelBuilder.Entity<TransitSchedule>()
            .Property(schedule => schedule.Name)
            .IsRequired()
            .HasMaxLength(100);

        modelBuilder.Entity<TransitSchedule>()
            .HasOne(schedule => schedule.TransitRoute)
            .WithMany(route => route.Schedules)
            .HasForeignKey(schedule => schedule.TransitRouteId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TransitSchedule>()
            .HasIndex(schedule => schedule.TransitRouteId);

        modelBuilder.Entity<TransitSchedule>()
            .HasIndex(schedule => new
            {
                schedule.TransitRouteId,
                schedule.Name
            });

        modelBuilder.Entity<TransitTrip>()
            .Property(trip => trip.TripCode)
            .IsRequired()
            .HasMaxLength(40);

        modelBuilder.Entity<TransitTrip>()
            .Property(trip => trip.VehicleType)
            .IsRequired()
            .HasMaxLength(20)
            .HasDefaultValue("Bus");

        modelBuilder.Entity<TransitTrip>()
            .Property(trip => trip.DepartureTime)
            .HasColumnType("time without time zone");

        modelBuilder.Entity<TransitTrip>()
            .HasOne(trip => trip.TransitRoute)
            .WithMany(route => route.Trips)
            .HasForeignKey(trip => trip.TransitRouteId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TransitTrip>()
            .HasOne(trip => trip.TransitSchedule)
            .WithMany(schedule => schedule.Trips)
            .HasForeignKey(trip => trip.TransitScheduleId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TransitTrip>()
            .HasIndex(trip => trip.TripCode)
            .IsUnique();

        modelBuilder.Entity<TransitTrip>()
            .HasIndex(trip => new
            {
                trip.TransitRouteId,
                trip.DepartureTime
            });

        modelBuilder.Entity<TransitTripStop>()
            .HasOne(tripStop => tripStop.TransitTrip)
            .WithMany(trip => trip.Stops)
            .HasForeignKey(tripStop => tripStop.TransitTripId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TransitTripStop>()
            .HasOne(tripStop => tripStop.TransitStop)
            .WithMany(stop => stop.TripStops)
            .HasForeignKey(tripStop => tripStop.TransitStopId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TransitTripStop>()
            .HasIndex(tripStop => new
            {
                tripStop.TransitTripId,
                tripStop.StopSequence
            })
            .IsUnique();

        modelBuilder.Entity<TransitTripStop>()
            .HasIndex(tripStop => new
            {
                tripStop.TransitTripId,
                tripStop.TransitStopId
            })
            .IsUnique();

        // =====================================================
        // KULLANICI BAZLI VERİ İZOLASYONU
        //
        // Her kullanıcı yalnızca kendi oluşturduğu toplu taşıma
        // ve POI verilerini görür. Filtreler EF Core tarafından
        // bu tablolara yapılan bütün sorgulara otomatik eklenir.
        // =====================================================

        modelBuilder.Entity<Poi>()
            .HasQueryFilter(poi =>
                CurrentUserId == null ||
                poi.UserId == CurrentUserId
            );

        // İstanbul metro hatları (SystemData.IstanbulMetroUsername) herkese görünür.
        modelBuilder.Entity<TransitStop>()
            .HasQueryFilter(stop =>
                CurrentUserId == null ||
                stop.UserId == CurrentUserId ||
                (
                    stop.User != null &&
                    stop.User.Username == SystemData.IstanbulMetroUsername
                )
            );

        // Eski güzergahlarda CreatedUserId boş olabilir; bu durumda
        // sahiplik güzergahın duraklarını kimin eklediğine göre belirlenir.
        modelBuilder.Entity<TransitRoute>()
            .HasQueryFilter(route =>
                CurrentUserId == null ||
                route.CreatedUserId == CurrentUserId ||
                (
                    route.CreatedUser != null &&
                    route.CreatedUser.Username == SystemData.IstanbulMetroUsername
                ) ||
                (
                    route.CreatedUserId == null &&
                    route.Stops.Any(stop =>
                        stop.UserId == CurrentUserId
                    )
                )
            );

        modelBuilder.Entity<TransitSchedule>()
            .HasQueryFilter(schedule =>
                CurrentUserId == null ||
                (
                    schedule.TransitRoute != null &&
                    (
                        schedule.TransitRoute.CreatedUserId == CurrentUserId ||
                        (
                            schedule.TransitRoute.CreatedUser != null &&
                            schedule.TransitRoute.CreatedUser.Username == SystemData.IstanbulMetroUsername
                        ) ||
                        (
                            schedule.TransitRoute.CreatedUserId == null &&
                            schedule.TransitRoute.Stops.Any(stop =>
                                stop.UserId == CurrentUserId
                            )
                        )
                    )
                )
            );

        modelBuilder.Entity<TransitTrip>()
            .HasQueryFilter(trip =>
                CurrentUserId == null ||
                (
                    trip.TransitRoute != null &&
                    (
                        trip.TransitRoute.CreatedUserId == CurrentUserId ||
                        (
                            trip.TransitRoute.CreatedUser != null &&
                            trip.TransitRoute.CreatedUser.Username == SystemData.IstanbulMetroUsername
                        ) ||
                        (
                            trip.TransitRoute.CreatedUserId == null &&
                            trip.TransitRoute.Stops.Any(stop =>
                                stop.UserId == CurrentUserId
                            )
                        )
                    )
                )
            );

        modelBuilder.Entity<TransitTripStop>()
            .HasQueryFilter(tripStop =>
                CurrentUserId == null ||
                (
                    tripStop.TransitStop != null &&
                    (
                        tripStop.TransitStop.UserId == CurrentUserId ||
                        (
                            tripStop.TransitStop.User != null &&
                            tripStop.TransitStop.User.Username == SystemData.IstanbulMetroUsername
                        )
                    )
                )
            );
    }
}
