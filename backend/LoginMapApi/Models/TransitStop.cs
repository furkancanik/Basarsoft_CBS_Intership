using NetTopologySuite.Geometries;

namespace LoginMapApi.Models;

public class TransitStop
{
    public int Id { get; set; }

    public string Name { get; set; } = "";

    public int TransitRouteId { get; set; }

    public TransitRoute? TransitRoute { get; set; }

    public Point Geometry { get; set; } = null!;

    public int OrderNo { get; set; }

    public string StopType { get; set; } = "Bus";

    public int UserId { get; set; }

    public User? User { get; set; }

    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; }

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public DateTime? ModifiedDate { get; set; }

    public int? ModifiedUserId { get; set; }

    public ICollection<TransitTripStop> TripStops { get; set; }
        = new List<TransitTripStop>();
}
