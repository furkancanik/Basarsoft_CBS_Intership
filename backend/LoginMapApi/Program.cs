using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

using LoginMapApi.Data;
using LoginMapApi.Services;
using LoginMapApi.Services.Interfaces;
using LoginMapApi.Hubs;

using System.Text;

var builder = WebApplication.CreateBuilder(args);

// =====================================================
// JWT CONFIGURATION
// =====================================================

var jwtKey =
    builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException(
        "JWT key configuration bulunamadı."
    );

var key =
    Encoding.UTF8.GetBytes(jwtKey);

// =====================================================
// DATABASE
// =====================================================

builder.Services.AddDbContext<AppDbContext>(
    options =>
    {
        options.UseNpgsql(
            builder.Configuration.GetConnectionString(
                "DefaultConnection"
            ),
            npgsqlOptions =>
            {
                npgsqlOptions.UseNetTopologySuite();
            }
        );
    }
);

// =====================================================
// CONTROLLERS
// =====================================================

builder.Services.AddControllers();

// =====================================================
// SIGNALR
// =====================================================

builder.Services.AddSignalR();

// =====================================================
// NORMAL SERVICES
// =====================================================

builder.Services.AddScoped<
    ILineService,
    LineService
>();

builder.Services.AddScoped<
    IPointService,
    PointService
>();

builder.Services.AddScoped<
    IPolygonService,
    PolygonService
>();

builder.Services.AddScoped<
    IGeometryQueryService,
    GeometryQueryService
>();

// =====================================================
// TRANSIT JOURNEY PLANNER
//
// Yürüme / Otobüs / Metro yol tarifi.
// =====================================================

builder.Services.AddScoped<
    ITransitJourneyPlannerService,
    TransitJourneyPlannerService
>();

// =====================================================
// TRANSIT ROUTE GENERATION
//
// TransitRoutesController ve TransitStopsController
// tarafından kullanılır.
// =====================================================

builder.Services.AddScoped<
    ITransitRouteGenerationService,
    TransitRouteGenerationService
>();

// =====================================================
// VEHICLE SIMULATION
// =====================================================

builder.Services.AddSingleton<
    IVehicleSimulationService,
    VehicleSimulationService
>();

builder.Services.AddHostedService<
    VehicleSimulationBackgroundService
>();

// =====================================================
// DRIVING OSRM
//
// Araç güzergahları:
// localhost:5001
// =====================================================

builder.Services.AddHttpClient<
    IOsrmService,
    OsrmService
>(
    client =>
    {
        var baseUrl =
            builder.Configuration["Osrm:BaseUrl"]
            ?? "http://localhost:5001/";

        client.BaseAddress =
            new Uri(baseUrl);

        client.Timeout =
            TimeSpan.FromSeconds(60);
    }
);

// =====================================================
// WALKING OSRM
//
// Foot / pedestrian OSRM:
// localhost:5002
//
// Kullanım:
// - doğrudan yürüyüş
// - A -> biniş durağı
// - iniş durağı -> B
// - metro erişim yürüyüşleri
// =====================================================

builder.Services.AddHttpClient<
    IWalkingRouteService,
    WalkingRouteService
>(
    client =>
    {
        var baseUrl =
            builder.Configuration["WalkingOsrm:BaseUrl"]
            ?? "http://localhost:5002/";

        client.BaseAddress =
            new Uri(baseUrl);

        client.Timeout =
            TimeSpan.FromSeconds(30);
    }
);

// =====================================================
// CORS
// =====================================================

builder.Services.AddCors(
    options =>
    {
        options.AddPolicy(
            "ReactPolicy",
            policy =>
            {
                // Canlıda izin verilen adresler ortam değişkeninden
                // virgülle ayrılmış olarak verilir:
                // Cors__AllowedOrigins=https://site.vercel.app
                var allowedOrigins =
                    (builder.Configuration["Cors:AllowedOrigins"] ?? "")
                        .Split(
                            ',',
                            StringSplitOptions.RemoveEmptyEntries |
                            StringSplitOptions.TrimEntries
                        )
                        .Concat(new[]
                        {
                            "http://localhost:5173",
                            "http://localhost:5174"
                        })
                        .Distinct()
                        .ToArray();

                policy
                    .WithOrigins(allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            }
        );
    }
);

// =====================================================
// AUTHENTICATION
// =====================================================

builder.Services
    .AddAuthentication(
        JwtBearerDefaults.AuthenticationScheme
    )
    .AddJwtBearer(
        options =>
        {
            options.TokenValidationParameters =
                new TokenValidationParameters
                {
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,

                    IssuerSigningKey =
                        new SymmetricSecurityKey(
                            key
                        ),

                    ClockSkew =
                        TimeSpan.Zero
                };

            // =========================================
            // SIGNALR TOKEN
            // =========================================

            options.Events =
                new JwtBearerEvents
                {
                    OnMessageReceived =
                        context =>
                        {
                            var accessToken =
                                context.Request
                                    .Query["access_token"];

                            var requestPath =
                                context.HttpContext
                                    .Request
                                    .Path;

                            if (
                                !string.IsNullOrWhiteSpace(
                                    accessToken
                                ) &&
                                requestPath.StartsWithSegments(
                                    "/hubs/vehicle"
                                )
                            )
                            {
                                context.Token =
                                    accessToken;
                            }

                            return Task.CompletedTask;
                        }
                };
        }
    );

builder.Services.AddAuthorization();

// =====================================================
// BUILD
// =====================================================

var app = builder.Build();

// =====================================================
// PROFILE IMAGES
// =====================================================

var profileImagesPath =
    Path.Combine(
        builder.Environment.ContentRootPath,
        "wwwroot",
        "profile-images"
    );

if (!Directory.Exists(profileImagesPath))
{
    Directory.CreateDirectory(
        profileImagesPath
    );
}

// =====================================================
// STATIC FILES
// =====================================================

app.UseStaticFiles();

app.UseStaticFiles(
    new StaticFileOptions
    {
        FileProvider =
            new PhysicalFileProvider(
                profileImagesPath
            ),

        RequestPath =
            "/profile-images"
    }
);

// =====================================================
// CORS
// =====================================================

app.UseCors(
    "ReactPolicy"
);

// =====================================================
// AUTH
// =====================================================

app.UseAuthentication();

app.UseAuthorization();

// =====================================================
// CONTROLLERS
// =====================================================

app.MapControllers();

// =====================================================
// SIGNALR
// =====================================================

app.MapHub<VehicleHub>(
    "/hubs/vehicle"
);

// =====================================================
// RUN
// =====================================================

app.Run();