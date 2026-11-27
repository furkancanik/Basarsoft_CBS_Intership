using LoginMapApi.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace LoginMapApi.Hubs;

[Authorize]
public class VehicleHub : Hub
{
    private readonly AppDbContext _context;

    public VehicleHub(AppDbContext context)
    {
        _context = context;
    }

    /*
     * Kullanıcı yalnızca kendi oluşturduğu güzergahların
     * araç yayınına katılabilir.
     */
    private async Task<bool> UserOwnsRoute(int routeId)
    {
        var claim = Context.User?
            .FindFirst(ClaimTypes.NameIdentifier)?
            .Value;

        if (!int.TryParse(claim, out var userId))
        {
            return false;
        }

        return await _context.TransitRoutes
            .IgnoreQueryFilters()
            .AnyAsync(route =>
                route.Id == routeId &&
                (
                    route.CreatedUserId == userId ||
                    (
                        route.CreatedUser != null &&
                        (route.CreatedUser.Username == SystemData.IstanbulMetroUsername || route.CreatedUser.Username == SystemData.TurkiyeHatlariUsername)
                    ) ||
                    (
                        route.CreatedUserId == null &&
                        route.Stops.Any(stop =>
                            stop.UserId == userId
                        )
                    )
                )
            );
    }
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

        if (!await UserOwnsRoute(routeId))
        {
            throw new HubException(
                "Bu güzergahı takip etme yetkiniz yok."
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
