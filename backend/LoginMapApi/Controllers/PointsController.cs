using LoginMapApi.Models;
using LoginMapApi.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace LoginMapApi.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class PointsController : ControllerBase
{
    private readonly IPointService _pointService;

    public PointsController(IPointService pointService)
    {
        _pointService = pointService;
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!int.TryParse(claim, out var userId))
            throw new UnauthorizedAccessException("Token içinde kullanıcı ID bulunamadı.");

        return userId;
    }

    [HttpGet]
    public IActionResult GetPoints()
    {
        try
        {
            return Ok(_pointService.GetPoints(GetUserId()));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Pointler alınırken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpPost]
    public IActionResult AddPoint([FromBody] GeometryRequest request)
    {
        try
        {
            return Ok(_pointService.AddPoint(request, GetUserId()));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Point eklenirken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpPut("{id:int}")]
    public IActionResult UpdatePoint(int id, [FromBody] GeometryRequest request)
    {
        try
        {
            var result = _pointService.UpdatePoint(id, request, GetUserId());

            if (!result)
                return NotFound(new { message = "Point bulunamadı.", id });

            return Ok(new { message = "Point başarıyla güncellendi.", id });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Point güncellenirken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpDelete("{id:int}")]
    public IActionResult DeletePoint(int id)
    {
        try
        {
            var result = _pointService.DeletePoint(id, GetUserId());

            if (!result)
                return NotFound(new { message = "Point bulunamadı.", id });

            return Ok(new { message = "Point başarıyla silindi.", id });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Point silinirken hata oluştu.",
                error = ex.Message
            });
        }
    }
}
