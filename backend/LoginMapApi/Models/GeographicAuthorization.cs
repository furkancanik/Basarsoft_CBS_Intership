using NetTopologySuite.Geometries;

namespace LoginMapApi.Models;

public class GeographicAuthorization
{
    public int Id { get; set; }

    public int? UserId { get; set; }
    public User? User { get; set; }

    public int? RoleId { get; set; }
    public Role? Role { get; set; }

    public Geometry Geometry { get; set; } = null!;

    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; } = false;

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
}