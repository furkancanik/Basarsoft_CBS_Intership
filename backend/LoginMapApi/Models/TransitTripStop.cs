namespace LoginMapApi.Models;

public class TransitTripStop
{
    public int Id { get; set; }

    public int TransitTripId { get; set; }

    public TransitTrip? TransitTrip { get; set; }

    public int TransitStopId { get; set; }

    public TransitStop? TransitStop { get; set; }

    public int StopSequence { get; set; }

    public int ArrivalOffsetSeconds { get; set; }

    public int DepartureOffsetSeconds { get; set; }

    public int DwellSeconds { get; set; } = 10;
}
