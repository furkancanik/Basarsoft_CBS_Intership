using LoginMapApi.Models;

namespace LoginMapApi.Services.Interfaces;

public interface IGeometryQueryService
{
    object Search(GeometryQueryRequest request, int userId);
}