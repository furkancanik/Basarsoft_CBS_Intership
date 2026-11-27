using System.Security.Claims;
using LoginMapApi.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace LoginMapApi.Security;

/*
 * Admin yetkisi kontrolü.
 *
 * Roller JWT içinde taşınmadığı için kontrol veritabanındaki
 * UserRoles kayıtlarıyla yapılır. Rol adı karşılaştırması arayüzdeki
 * normalize() ile aynı kurallara göre yapılır ("Admin", "admin" ...).
 */
public static class AdminAccess
{
    public static int? GetUserId(ClaimsPrincipal user)
    {
        var value =
            user.FindFirstValue(ClaimTypes.NameIdentifier) ??
            user.FindFirstValue("nameid") ??
            user.FindFirstValue("sub");

        return int.TryParse(value, out var id) ? id : null;
    }

    public static string NormalizeRoleName(string? value)
    {
        return (value ?? "")
            .ToLower(new System.Globalization.CultureInfo("tr-TR"))
            .Replace(" ", "")
            .Replace(".", "")
            .Replace("_", "")
            .Replace("-", "")
            .Replace("ö", "o")
            .Replace("ü", "u")
            .Replace("ş", "s")
            .Replace("ı", "i")
            .Replace("ğ", "g")
            .Replace("ç", "c");
    }

    public static async Task<bool> IsAdminAsync(
        AppDbContext context,
        ClaimsPrincipal user,
        CancellationToken cancellationToken = default
    )
    {
        var userId = GetUserId(user);

        if (userId == null)
        {
            return false;
        }

        var roleNames = await context.UserRoles
            .AsNoTracking()
            .Where(userRole =>
                userRole.UserId == userId.Value &&
                userRole.Role.IsActive &&
                !userRole.Role.IsDeleted &&
                userRole.User.IsActive &&
                !userRole.User.IsDeleted
            )
            .Select(userRole => userRole.Role.Name)
            .ToListAsync(cancellationToken);

        return roleNames.Any(name =>
            NormalizeRoleName(name) == "admin"
        );
    }
}

/*
 * Sadece Admin rolündeki kullanıcıların çağırabileceği uçlar için.
 * Giriş yapılmamışsa 401, admin değilse 403 döner.
 */
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class AdminOnlyAttribute : Attribute, IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(
        AuthorizationFilterContext context
    )
    {
        var user = context.HttpContext.User;

        if (user?.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var dbContext = context.HttpContext.RequestServices
            .GetRequiredService<AppDbContext>();

        if (!await AdminAccess.IsAdminAsync(
                dbContext,
                user,
                context.HttpContext.RequestAborted))
        {
            context.Result = new ObjectResult(new
            {
                message = "Bu işlem için Admin yetkisi gerekiyor."
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }
    }
}
