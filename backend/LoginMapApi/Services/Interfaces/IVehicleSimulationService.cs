using LoginMapApi.Models;

namespace LoginMapApi.Services.Interfaces;

public interface IVehicleSimulationService
{
    /// <summary>
    /// Belirtilen sefer için yeni bir araç simülasyonu başlatır.
    ///
    /// Aynı tripId için bu metot birden fazla kez çağrılabilir.
    /// Her çağrıda yeni ve bağımsız bir SimulationId üretilir.
    /// </summary>
    Task<VehicleSimulationState> StartTripAsync(
        int tripId,
        int startedByUserId,
        bool isAutomatic = false,
        string? vehicleCode = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Tek bir araç simülasyonunu SimulationId üzerinden durdurur.
    /// </summary>
    Task<bool> StopSimulationAsync(
        Guid simulationId,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Belirli bir sefer üzerinde çalışan bütün
    /// araç simülasyonlarını durdurur.
    ///
    /// Dönen değer durdurulan araç sayısıdır.
    /// </summary>
    Task<int> StopTripSimulationsAsync(
        int tripId,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Belirli bir güzergah üzerinde çalışan bütün
    /// araç simülasyonlarını durdurur.
    ///
    /// Dönen değer durdurulan araç sayısıdır.
    /// </summary>
    Task<int> StopRouteSimulationsAsync(
        int routeId,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Belirli bir SimulationId'ye ait
    /// araç simülasyonunun anlık durumunu döndürür.
    /// </summary>
    VehicleSimulationState? GetState(
        Guid simulationId
    );

    /// <summary>
    /// Belirli bir sefer üzerinde çalışan
    /// bütün araç simülasyonlarını döndürür.
    /// </summary>
    IReadOnlyCollection<VehicleSimulationState>
        GetTripSimulations(
            int tripId
        );

    /// <summary>
    /// Belirli bir güzergah üzerinde çalışan
    /// bütün araç simülasyonlarını döndürür.
    /// </summary>
    IReadOnlyCollection<VehicleSimulationState>
        GetRouteSimulations(
            int routeId
        );

    /// <summary>
    /// Sistemde çalışan bütün araç
    /// simülasyonlarını döndürür.
    /// </summary>
    IReadOnlyCollection<VehicleSimulationState>
        GetRunningSimulations();

    /// <summary>
    /// VehicleSimulationBackgroundService tarafından
    /// düzenli aralıklarla çağrılır.
    ///
    /// Çalışan bütün araçların:
    ///
    /// - hızını,
    /// - konumunu,
    /// - durağa kalan mesafesini,
    /// - ETA bilgisini,
    /// - durak bekleme süresini,
    /// - hızlanma ve frenleme durumunu
    ///
    /// günceller.
    /// </summary>
    Task TickAsync(
        TimeSpan elapsed,
        CancellationToken cancellationToken = default
    );
}