using LoginMapApi.Services.Interfaces;

namespace LoginMapApi.Services;

public class VehicleSimulationBackgroundService : BackgroundService
{
    private readonly IVehicleSimulationService _simulationService;
    private readonly ILogger<VehicleSimulationBackgroundService> _logger;
    private readonly IConfiguration _configuration;

    public VehicleSimulationBackgroundService(
        IVehicleSimulationService simulationService,
        ILogger<VehicleSimulationBackgroundService> logger,
        IConfiguration configuration
    )
    {
        _simulationService = simulationService;
        _logger = logger;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken
    )
    {
        /*
         * Bir saniyelik yayın aralığında TimeScale yüksek olduğunda araç,
         * kullanıcıya tek pakette kilometrelerce ilerlemiş görünür.
         *
         * 100 ms varsayılan aralıkla konumu daha sık yayınlıyoruz.
         * TickAsync gerçek geçen süreyi aldığı için simülasyon hızı değişmez;
         * yalnızca haritadaki hareket daha sık ve akıcı güncellenir.
         */
        var updateIntervalMilliseconds = Math.Clamp(
            _configuration.GetValue<int?>(
                "VehicleSimulation:UpdateIntervalMilliseconds"
            ) ?? 100,
            50,
            1000
        );

        var interval = TimeSpan.FromMilliseconds(
            updateIntervalMilliseconds
        );

        using var timer = new PeriodicTimer(interval);

        while (
            await timer.WaitForNextTickAsync(stoppingToken)
        )
        {
            try
            {
                await _simulationService.TickAsync(
                    interval,
                    stoppingToken
                );
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Araç simülasyonu güncellenirken hata oluştu."
                );
            }
        }
    }
}
