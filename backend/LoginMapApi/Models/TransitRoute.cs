namespace LoginMapApi.Models;

public class TransitRoute
{
    public int Id { get; set; }

    public string Name { get; set; } = "";

    public string ShortCode { get; set; } = "";

    public string Color { get; set; } = "#2563eb";

    public string? RouteWkt { get; set; }

    public double? DistanceMeters { get; set; }

    public double? DurationSeconds { get; set; }

    public DateTime? RouteUpdatedDate { get; set; }

    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; }

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public int? CreatedUserId { get; set; }

    public User? CreatedUser { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public int? ModifiedUserId { get; set; }

    public ICollection<TransitStop> Stops { get; set; }
        = new List<TransitStop>();

    public ICollection<TransitSchedule> Schedules { get; set; }
        = new List<TransitSchedule>();

    public ICollection<TransitTrip> Trips { get; set; }
        = new List<TransitTrip>();
}
