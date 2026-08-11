namespace LoginMapApi.Models;

public class VehicleSimulationStopState
{
    public int StopId { get; set; }

    public string StopName { get; set; } = "";

    public int OrderNo { get; set; }

    /*
     * Durağın rota başlangıcından itibaren
     * metre cinsinden konumu.
     */
    public double RouteDistanceMeters { get; set; }

    /*
     * Durağın rota üzerindeki yüzde konumu.
     * Değer aralığı: 0-100
     */
    public double RouteProgress { get; set; }

    /*
     * EPSG:4326 durak koordinatı.
     */
    public double Longitude { get; set; }

    public double Latitude { get; set; }

    /*
     * Araç bu durağa ulaştı mı?
     */
    public bool IsVisited { get; set; }

    /*
     * Aracın bu durakta bekleyeceği toplam süre.
     *
     * Birim: simülasyon saniyesi
     */
    public double DwellDurationSeconds { get; set; }

    /*
     * Aracın bu durakta gerçekten beklediği süre.
     */
    public double WaitedSeconds { get; set; }
}

public class VehicleSimulationState
{
    /*
     * Her çalışan araç simülasyonunun benzersiz kimliği.
     *
     * Aynı route ve aynı trip üzerinde birden fazla
     * aracın birbirinden ayrılmasını sağlar.
     */
    public Guid SimulationId { get; set; }

    /*
     * Aracın çalıştığı sefer.
     */
    public int TripId { get; set; }

    public string TripCode { get; set; } = "";

    /*
     * Haritada ve dashboard üzerinde gösterilebilecek
     * araç kodu.
     *
     * Örnek:
     * BUS-001
     * METRO-02
     */
    public string VehicleCode { get; set; } = "";

    /*
     * Simülasyonun çalıştığı servis günü.
     */
    public DateOnly ServiceDate { get; set; }

    /*
     * TransitTrip üzerindeki planlanan kalkış saati.
     */
    public TimeOnly DepartureTime { get; set; }

    /*
     * Simülasyon kullanıcı tarafından mı,
     * yoksa ileride ekleyeceğimiz scheduler tarafından
     * otomatik mi başlatıldı?
     */
    public bool IsAutomatic { get; set; }

    /*
     * Seferin bağlı olduğu güzergah.
     */
    public int RouteId { get; set; }

    public string RouteName { get; set; } = "";

    public string ShortCode { get; set; } = "";

    public string RouteColor { get; set; } = "#2563eb";

    public string VehicleType { get; set; } = "Bus";

    public bool IsRunning { get; set; }

    /*
     * Rota üzerindeki ilerleme yüzdesi.
     *
     * Değer aralığı: 0-100
     */
    public double Progress { get; set; }

    /*
     * EPSG:4326 anlık araç koordinatı.
     */
    public double Longitude { get; set; }

    public double Latitude { get; set; }

    /*
     * Simülasyonu başlatan kullanıcı.
     *
     * Scheduler ile otomatik başlatılan araçlarda
     * ileride sistem kullanıcısı kullanılabilir.
     */
    public int StartedByUserId { get; set; }

    public DateTime StartedDate { get; set; }

    public DateTime LastUpdatedDate { get; set; }

    /*
     * Eski kodla geriye uyumluluk için tutulur.
     *
     * Yeni dinamik hız modelinde ilerleme hesabı
     * bu alan üzerinden yapılmaz.
     */
    public double SimulationDurationSeconds { get; set; }

    /*
     * Frontend'e gönderilmeyen gerçek OSRM
     * rota geometrisi.
     */
    public string RouteWkt { get; set; } = "";

    /*
     * Aracın anlık hızı.
     *
     * Birim: kilometre/saat
     */
    public double CurrentSpeedKmh { get; set; }

    /*
     * Araç türüne göre uygulanacak maksimum hız.
     *
     * Birim: kilometre/saat
     */
    public double MaxSpeedKmh { get; set; }

    /*
     * Rota başlangıcından itibaren kat edilen mesafe.
     *
     * Birim: metre
     */
    public double TravelledDistanceMeters { get; set; }

    /*
     * Toplam rota uzunluğu.
     *
     * Birim: metre
     */
    public double RouteLengthMeters { get; set; }

    /*
     * Aracın en son geçtiği veya bulunduğu durak.
     */
    public int? PreviousStopId { get; set; }

    public string PreviousStopName { get; set; } = "";

    /*
     * Aracın sıradaki hedef durağı.
     */
    public int? NextStopId { get; set; }

    public string NextStopName { get; set; } = "";

    /*
     * Sıradaki durağa kalan rota mesafesi.
     *
     * Birim: metre
     */
    public double? DistanceToNextStopMeters { get; set; }

    /*
     * Sıradaki durağa tahmini varış süresi.
     *
     * Birim: saniye
     */
    public double? EstimatedArrivalSeconds { get; set; }

    /*
     * Aracın anlık çalışma durumu.
     *
     * Kullanılabilecek durumlar:
     *
     * WaitingAtStart
     * Accelerating
     * Cruising
     * ApproachingStop
     * ArrivedAtStop
     * WaitingAtStop
     * DepartingStop
     * Completed
     * Stopped
     */
    public string Status { get; set; } = "WaitingAtStart";

    /*
     * Servis içi durak listesi.
     *
     * SignalR payload'ına doğrudan eklenmez.
     */
    public List<VehicleSimulationStopState> Stops { get; set; } = new();

    /*
     * Bir sonraki hedef durağın Stops
     * listesindeki indeksi.
     *
     * İlk durak başlangıç durağı olduğu için
     * varsayılan hedef indeks 1'dir.
     */
    public int NextStopIndex { get; set; } = 1;

    /*
     * Araç şu anda bir durakta bekliyor mu?
     */
    public bool IsWaitingAtStop { get; set; }

    /*
     * Aracın şu anda beklediği durağın kimliği.
     */
    public int? WaitingStopId { get; set; }

    public string WaitingStopName { get; set; } = "";

    /*
     * Mevcut durakta geçirilen bekleme süresi.
     *
     * Birim: simülasyon saniyesi
     */
    public double CurrentStopWaitSeconds { get; set; }

    /*
     * Mevcut durakta beklenecek toplam süre.
     *
     * Birim: simülasyon saniyesi
     */
    public double StopDwellDurationSeconds { get; set; }

    /*
     * Mevcut durakta kalan bekleme süresi.
     *
     * Birim: simülasyon saniyesi
     */
    public double RemainingStopWaitSeconds { get; set; }

    /*
     * Duraktan yeni ayrılma durumunda kısa süreli olarak
     * DepartingStop durumunun gösterilmesi için kullanılır.
     */
    public double DepartingStateRemainingSeconds { get; set; }

    /*
     * İlk durakta simülasyon başlarken bekleme uygulanıp
     * uygulanmadığını kontrol eder.
     */
    public bool InitialStopProcessed { get; set; }
}