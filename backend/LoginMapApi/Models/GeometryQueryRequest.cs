namespace LoginMapApi.Models;

public class GeometryQueryRequest
{
    public string? Name { get; set; }

    public string? Type { get; set; }

    public DateTime? StartDate { get; set; }

    public DateTime? EndDate { get; set; }

    public string? SortBy { get; set; } = "CreatedDate";

    public bool Desc { get; set; } = true;
}