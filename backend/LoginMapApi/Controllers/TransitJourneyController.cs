using LoginMapApi.Data;
using LoginMapApi.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoginMapApi.Controllers;

[Authorize]
[ApiController]
[Route("api/transit-journey")]
public class TransitJourneyController : ControllerBase
{
    private readonly ITransitJourneyPlannerService _journeyPlannerService;
    private readonly AppDbContext _context;

    public TransitJourneyController(
        ITransitJourneyPlannerService journeyPlannerService,
        AppDbContext context
    )
    {
        _journeyPlannerService = journeyPlannerService;
        _context = context;
    }

    [HttpPost("plan")]
    public async Task<IActionResult> PlanJourney(
        [FromBody] TransitJourneyPlanRequest request,
        CancellationToken cancellationToken
    )
    {
        return await PlanInternal(
            request,
            null,
            null,
            cancellationToken
        );
    }

    /*
     * A/B haritadan seçmek yerine direkt kayıtlı POI kullanır.
     *
     * POST /api/transit-journey/plan-poi
     * {
     *   "startPoiId": 12,
     *   "endPoiId": 44
     * }
     */
    [HttpPost("plan-poi")]
    public async Task<IActionResult> PlanPoiJourney(
        [FromBody] PoiJourneyPlanRequest request,
        CancellationToken cancellationToken
    )
    {
        if (request.StartPoiId == request.EndPoiId)
        {
            return BadRequest(new
            {
                message =
                    "Başlangıç ve hedef POI aynı olamaz."
            });
        }

        var poiIds = new[]
        {
            request.StartPoiId,
            request.EndPoiId
        };

        var pois = await _context.Pois
            .AsNoTracking()
            .Where(poi =>
                poiIds.Contains(poi.Id) &&
                poi.IsActive &&
                !poi.IsDeleted &&
                poi.Geometry != null
            )
            .ToListAsync(cancellationToken);

        var startPoi =
            pois.FirstOrDefault(
                poi => poi.Id == request.StartPoiId
            );

        var endPoi =
            pois.FirstOrDefault(
                poi => poi.Id == request.EndPoiId
            );

        if (startPoi == null || endPoi == null)
        {
            return NotFound(new
            {
                message =
                    "Başlangıç veya hedef POI bulunamadı."
            });
        }

        var planRequest =
            new TransitJourneyPlanRequest
            {
                StartLongitude =
                    startPoi.Geometry.X,
                StartLatitude =
                    startPoi.Geometry.Y,
                EndLongitude =
                    endPoi.Geometry.X,
                EndLatitude =
                    endPoi.Geometry.Y,
                DepartureDateTime =
                    request.DepartureDateTime,
                MaximumWalkingDistanceMeters =
                    request.MaximumWalkingDistanceMeters,
                CandidateStopCount =
                    request.CandidateStopCount,
                AlternativeCount =
                    request.AlternativeCount
            };

        return await PlanInternal(
            planRequest,
            new
            {
                startPoi.Id,
                startPoi.Name
            },
            new
            {
                endPoi.Id,
                endPoi.Name
            },
            cancellationToken
        );
    }

    private async Task<IActionResult> PlanInternal(
        TransitJourneyPlanRequest request,
        object? startPoi,
        object? endPoi,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var result =
                await _journeyPlannerService.PlanAsync(
                    request,
                    cancellationToken
                );

            return Ok(new
            {
                message =
                    result.Alternatives.Count == 0
                        ? "Uygun rota bulunamadı."
                        : $"{result.Alternatives.Count} rota alternatifi bulundu.",
                startPoi,
                endPoi,
                result.RequestedDepartureDateTime,
                result.StartLongitude,
                result.StartLatitude,
                result.EndLongitude,
                result.EndLatitude,
                alternatives =
                    result.Alternatives
            });
        }
        catch (OperationCanceledException)
        {
            return StatusCode(
                408,
                new
                {
                    message =
                        "Rota isteği zaman aşımına uğradı."
                }
            );
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(
                new { message = ex.Message }
            );
        }
        catch (Exception ex)
        {
            return StatusCode(
                500,
                new
                {
                    message =
                        "Yol tarifi hesaplanırken hata oluştu.",
                    error = ex.Message,
                    innerError =
                        ex.InnerException?.Message
                }
            );
        }
    }
}

public sealed class PoiJourneyPlanRequest
{
    public int StartPoiId { get; set; }
    public int EndPoiId { get; set; }
    public DateTime? DepartureDateTime { get; set; }

    public double MaximumWalkingDistanceMeters
        { get; set; } = 2500;

    public int CandidateStopCount
        { get; set; } = 8;

    public int AlternativeCount
        { get; set; } = 5;
}
