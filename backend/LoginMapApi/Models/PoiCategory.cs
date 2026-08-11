namespace LoginMapApi.Models;

public class PoiCategory
{
    public int Id { get; set; }

    public string Name { get; set; } = "";

    public int? ParentId { get; set; }

    public PoiCategory? Parent { get; set; }

    public ICollection<PoiCategory> Children { get; set; }
        = new List<PoiCategory>();

    public ICollection<Poi> Pois { get; set; }
        = new List<Poi>();

    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; } = false;

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public DateTime? ModifiedDate { get; set; }

    public int? CreatedUserId { get; set; }

    public int? ModifiedUserId { get; set; }
}