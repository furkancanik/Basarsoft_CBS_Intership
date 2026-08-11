using NetTopologySuite.Geometries;

namespace LoginMapApi.Models;

public class Poi
{
    public int Id { get; set; }

    public string Name { get; set; } = "";

    public int PoiCategoryId { get; set; }

    public PoiCategory? PoiCategory { get; set; }

    public TimeSpan OpeningTime { get; set; }

    public TimeSpan ClosingTime { get; set; }

    public Point Geometry { get; set; } = null!;

    public int UserId { get; set; }

    public User? User { get; set; }

    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; } = false;

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public DateTime? ModifiedDate { get; set; }

    public int? ModifiedUserId { get; set; }
}