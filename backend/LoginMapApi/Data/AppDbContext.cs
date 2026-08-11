using LoginMapApi.Models;
using Microsoft.EntityFrameworkCore;

namespace LoginMapApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
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
    }
}
