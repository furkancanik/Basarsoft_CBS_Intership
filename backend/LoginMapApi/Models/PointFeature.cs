using NetTopologySuite.Geometries;

namespace LoginMapApi.Models;

public class PointFeature
{
    public int Id { get; set; }

    public string Name { get; set; } = "";

    public string Color { get; set; } = "#3388ff";

    public string Description { get; set; } = "";

    public Point Geometry { get; set; } = null!;

    public int UserId { get; set; }

    public User User { get; set; } = null!;

    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; } = false;

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public DateTime? ModifiedDate { get; set; }

    public int? ModifiedUserId { get; set; }
}