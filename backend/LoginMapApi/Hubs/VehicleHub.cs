using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace LoginMapApi.Hubs;

[Authorize]
public class VehicleHub : Hub
{
    /*
     * Kullanıcı belirli bir güzergahın araç yayınını takip etmeye başlar.
     * Her güzergah için ayrı SignalR grubu kullanılır.
     */
    public async Task JoinRouteGroup(int routeId)
    {
        if (routeId <= 0)
        {
            throw new HubException(
                "Geçerli bir güzergah seçilmelidir."
            );
        }

        await Groups.AddToGroupAsync(
            Context.ConnectionId,
            GetRouteGroupName(routeId)
        );
    }

    /*
     * Kullanıcı güzergah takibini bıraktığında gruptan çıkarılır.
     */
    public async Task LeaveRouteGroup(int routeId)
    {
        if (routeId <= 0)
        {
            return;
        }

        await Groups.RemoveFromGroupAsync(
            Context.ConnectionId,
            GetRouteGroupName(routeId)
        );
    }

    public override async Task OnDisconnectedAsync(
        Exception? exception
    )
    {
        await base.OnDisconnectedAsync(exception);
    }

    public static string GetRouteGroupName(int routeId)
    {
        return $"transit-route-{routeId}";
    }
}
