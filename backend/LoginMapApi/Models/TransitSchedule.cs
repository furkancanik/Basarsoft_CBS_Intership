namespace LoginMapApi.Models;

public class TransitSchedule
{
    public int Id { get; set; }

    public int TransitRouteId { get; set; }

    public TransitRoute? TransitRoute { get; set; }

    public string Name { get; set; } = "";

    public DateTime ValidFrom { get; set; } = DateTime.UtcNow.Date;

    public DateTime? ValidTo { get; set; }

    public bool RunsMonday { get; set; } = true;
    public bool RunsTuesday { get; set; } = true;
    public bool RunsWednesday { get; set; } = true;
    public bool RunsThursday { get; set; } = true;
    public bool RunsFriday { get; set; } = true;
    public bool RunsSaturday { get; set; }
    public bool RunsSunday { get; set; }

    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; }

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public DateTime? ModifiedDate { get; set; }

    public int? ModifiedUserId { get; set; }

    public ICollection<TransitTrip> Trips { get; set; }
        = new List<TransitTrip>();
}
