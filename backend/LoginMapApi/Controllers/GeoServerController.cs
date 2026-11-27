using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LoginMapApi.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class GeoServerController : ControllerBase
{
    private readonly HttpClient _httpClient;
    private readonly string _geoServerBaseUrl;

    public GeoServerController(
        HttpClient httpClient,
        IConfiguration configuration
    )
    {
        _httpClient = httpClient;

        _geoServerBaseUrl =
            (configuration["GeoServer:BaseUrl"]
                ?? "http://localhost:8080/geoserver/")
            .TrimEnd('/');
    }

    [HttpGet("features/{layerName}")]
    public async Task<IActionResult> GetFeatures(string layerName)
    {
        var allowedLayers = new[]
        {
            "Points",
            "Lines",
            "Polygons",
            "Pois",
            "vw_pois"
        };

        if (!allowedLayers.Contains(layerName))
            return BadRequest("Geçersiz layer adı.");

        var url =
            $"{_geoServerBaseUrl}/staj/ows" +
            $"?service=WFS" +
            $"&version=1.0.0" +
            $"&request=GetFeature" +
            $"&typeName=staj:{layerName}" +
            $"&outputFormat=application/json";

        var response = await _httpClient.GetAsync(url);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();

            return StatusCode(
                (int)response.StatusCode,
                $"GeoServer hatası:\n{error}"
            );
        }

        var json = await response.Content.ReadAsStringAsync();

        return Content(json, "application/json");
    }
}