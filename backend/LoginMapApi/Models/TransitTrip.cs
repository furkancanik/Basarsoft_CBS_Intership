namespace LoginMapApi.Models;

public class TransitTrip
{
    public int Id { get; set; }

    public int TransitRouteId { get; set; }

    public TransitRoute? TransitRoute { get; set; }

    public int TransitScheduleId { get; set; }

    public TransitSchedule? TransitSchedule { get; set; }

    public string TripCode { get; set; } = "";

    public string VehicleType { get; set; } = "Bus";

    public TimeOnly DepartureTime { get; set; }

    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; }

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public DateTime? ModifiedDate { get; set; }

    public int? ModifiedUserId { get; set; }

    public ICollection<TransitTripStop> Stops { get; set; }
        = new List<TransitTripStop>();
}
