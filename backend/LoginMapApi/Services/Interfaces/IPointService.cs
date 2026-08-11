using LoginMapApi.Models;

namespace LoginMapApi.Services.Interfaces;

public interface IPointService
{
    object GetPoints(int userId);
    object AddPoint(GeometryRequest request, int userId);
    bool DeletePoint(int id, int userId);
    bool UpdatePoint(int id, GeometryRequest request, int userId);
}