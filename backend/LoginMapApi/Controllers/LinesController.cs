using LoginMapApi.Models;
using LoginMapApi.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace LoginMapApi.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class LinesController : ControllerBase
{
    private readonly ILineService _lineService;

    public LinesController(ILineService lineService)
    {
        _lineService = lineService;
    }

    private int GetUserId()
    {
        return int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    }

    [HttpGet]
    public IActionResult GetLines()
    {
        try
        {
            return Ok(_lineService.GetLines(GetUserId()));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Lineler alınırken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpPost]
    public IActionResult AddLine([FromBody] GeometryRequest request)
    {
        try
        {
            return Ok(_lineService.AddLine(request, GetUserId()));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Line eklenirken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpPut("{id}")]
    public IActionResult UpdateLine(int id, [FromBody] GeometryRequest request)
    {
        try
        {
            var result = _lineService.UpdateLine(id, request, GetUserId());

            if (!result)
                return NotFound(new { message = "Line bulunamadı.", id });

            return Ok(new { message = "Line başarıyla güncellendi.", id });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Line güncellenirken hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpDelete("{id}")]
    public IActionResult DeleteLine(int id)
    {
        try
        {
            var result = _lineService.DeleteLine(id, GetUserId());

            if (!result)
                return NotFound(new { message = "Line bulunamadı.", id });

            return Ok(new { message = "Line başarıyla silindi.", id });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Line silinirken hata oluştu.",
                error = ex.Message
            });
        }
    }
}