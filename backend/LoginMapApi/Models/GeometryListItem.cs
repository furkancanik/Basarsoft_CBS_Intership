namespace LoginMapApi.Models;

public class GeometryListItem
{
    public int Id { get; set; }

    public string Type { get; set; } = "";

    public string Name { get; set; } = "";

    public string Color { get; set; } = "";

    public string Wkt { get; set; } = "";

    public DateTime CreatedDate { get; set; }
}