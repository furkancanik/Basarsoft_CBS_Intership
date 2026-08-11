namespace LoginMapApi.Models;

public class GeometryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
    public string Color { get; set; } = "";
    public string Description { get; set; } = "";
    public DateTime CreatedDate { get; set; }

    public string? Wkt { get; set; }
}