using LoginMapApi.Models;

namespace LoginMapApi.Services.Interfaces;

public interface IPolygonService
{
    object GetPolygons(int userId);
    object AddPolygon(GeometryRequest request, int userId);
    bool DeletePolygon(int id, int userId);
    bool UpdatePolygon(int id, GeometryRequest request, int userId);
}