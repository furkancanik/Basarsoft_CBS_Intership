using LoginMapApi.Models;
using LoginMapApi.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace LoginMapApi.Controllers;

[Authorize]
[ApiController]
[Route("api/geometry-query")]
public class GeometryQueryController : ControllerBase
{
    private readonly IGeometryQueryService _geometryQueryService;

    public GeometryQueryController(IGeometryQueryService geometryQueryService)
    {
        _geometryQueryService = geometryQueryService;
    }

    private int GetUserId()
    {
        return int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    }

    [HttpPost]
    public IActionResult Search([FromBody] GeometryQueryRequest request)
    {
        try
        {
            var result = _geometryQueryService.Search(request, GetUserId());
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Çizimler sorgulanırken hata oluştu.",
                error = ex.Message
            });
        }
    }
}