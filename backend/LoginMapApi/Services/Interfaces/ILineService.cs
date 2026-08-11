using LoginMapApi.Models;

namespace LoginMapApi.Services.Interfaces;

public interface ILineService
{
    object GetLines(int userId);
    object AddLine(GeometryRequest request, int userId);
    bool DeleteLine(int id, int userId);
    bool UpdateLine(int id, GeometryRequest request, int userId);
}