using LoginMapApi.Models;
using LoginMapApi.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace LoginMapApi.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class PolygonsController : ControllerBase
{
    private readonly IPolygonService _polygonService;

    public PolygonsController(IPolygonService polygonService)
    {
        _polygonService = polygonService;
    }

    private int GetUserId()
    {
        return int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    }

    [HttpGet]
    public IActionResult GetPolygons()
    {
        try
        {
            return Ok(_polygonService.GetPolygons(GetUserId()));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Polygonlar alınırken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpPost]
    public IActionResult AddPolygon([FromBody] GeometryRequest request)
    {
        try
        {
            return Ok(_polygonService.AddPolygon(request, GetUserId()));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Polygon eklenirken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpPut("{id}")]
    public IActionResult UpdatePolygon(int id, [FromBody] GeometryRequest request)
    {
        try
        {
            var result = _polygonService.UpdatePolygon(id, request, GetUserId());

            if (!result)
                return NotFound(new { message = "Polygon bulunamadı.", id });

            return Ok(new { message = "Polygon başarıyla güncellendi.", id });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Polygon güncellenirken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpDelete("{id}")]
    public IActionResult DeletePolygon(int id)
    {
        try
        {
            var result = _polygonService.DeletePolygon(id, GetUserId());

            if (!result)
                return NotFound(new { message = "Polygon bulunamadı.", id });

            return Ok(new { message = "Polygon başarıyla silindi.", id });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Polygon silinirken hata oluştu.",
                error = ex.Message
            });
        }
    }
}