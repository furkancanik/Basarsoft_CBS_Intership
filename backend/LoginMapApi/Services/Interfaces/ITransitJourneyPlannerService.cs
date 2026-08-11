namespace LoginMapApi.Services.Interfaces;

public class TransitJourneyPlanRequest
{
    public double StartLongitude { get; set; }
    public double StartLatitude { get; set; }
    public double EndLongitude { get; set; }
    public double EndLatitude { get; set; }
    public DateTime? DepartureDateTime { get; set; }

    // Toplu taşıma seçeneklerinde A -> durağa ve duraktan -> B'ye
    // GERÇEK yaya ağı üzerinden izin verilen azami yürüme mesafesi.
    public double MaximumWalkingDistanceMeters { get; set; } = 2500;

    public int CandidateStopCount { get; set; } = 8;

    // Otobüs ve metro için HER BİR ulaşım türünde
    // döndürülecek azami alternatif sayısı.
    public int AlternativeCount { get; set; } = 5;
}

public class TransitJourneyStep
{
    public string Type { get; set; } = "";
    public string Description { get; set; } = "";
    public double DistanceMeters { get; set; }
    public double DurationSeconds { get; set; }

    public double FromLongitude { get; set; }
    public double FromLatitude { get; set; }
    public double ToLongitude { get; set; }
    public double ToLatitude { get; set; }

    // Gerçek yol geometrisi.
    public string GeometryWkt { get; set; } = "";
}

public class TransitJourneyAlternative
{
    public int RouteId { get; set; }
    public string RouteName { get; set; } = "";
    public string RouteShortCode { get; set; } = "";
    public string RouteColor { get; set; } = "#2563eb";

    // Walk / Bus / Metro
    public string VehicleType { get; set; } = "Bus";

    public int TripId { get; set; }
    public string TripCode { get; set; } = "";

    public int BoardingStopId { get; set; }
    public string BoardingStopName { get; set; } = "";
    public int BoardingStopSequence { get; set; }

    public int AlightingStopId { get; set; }
    public string AlightingStopName { get; set; } = "";
    public int AlightingStopSequence { get; set; }

    public DateTime RequestedDepartureDateTime { get; set; }
    public DateTime BoardingDateTime { get; set; }
    public DateTime AlightingDateTime { get; set; }

    public double InitialWalkingMeters { get; set; }
    public double FinalWalkingMeters { get; set; }
    public double TotalWalkingMeters { get; set; }
    public double WalkingDurationSeconds { get; set; }
    public double WaitingDurationSeconds { get; set; }
    public double InVehicleDurationSeconds { get; set; }
    public double TotalDurationSeconds { get; set; }
    public double Score { get; set; }

    public string RouteWkt { get; set; } = "";

    public List<TransitJourneyStep> Steps { get; set; } = new();
}

public class TransitJourneyPlanResult
{
    public DateTime RequestedDepartureDateTime { get; set; }

    public double StartLongitude { get; set; }
    public double StartLatitude { get; set; }
    public double EndLongitude { get; set; }
    public double EndLatitude { get; set; }

    public List<TransitJourneyAlternative> Alternatives { get; set; } = new();
}

public interface ITransitJourneyPlannerService
{
    Task<TransitJourneyPlanResult> PlanAsync(
        TransitJourneyPlanRequest request,
        CancellationToken cancellationToken = default
    );
}
