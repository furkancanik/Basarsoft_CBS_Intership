# Turkey-Wide GIS Coordination Platform

A web-based Geographic Information System (GIS) developed during my internship at **Başarsoft Bilgi Teknolojileri A.Ş.** (POI Internship Program, 2026). The platform lets organizations manage spatial data, regional access, points of interest and intercity public transportation on a single interactive map.

> Built with **ASP.NET Core 8**, **React**, **OpenLayers**, **PostgreSQL/PostGIS**, **GeoServer**, **OSRM** and **SignalR**.

**Live demo:** [basarsoft-cbs.vercel.app](https://basarsoft-cbs.vercel.app) — create an account on the login screen to try it. The API runs on a free instance, so the first request after a period of inactivity can take up to a minute.

---

## Features

### Spatial data management
- Draw, edit and delete **points, lines and polygons** on the map, stored as PostGIS geometries (NetTopologySuite + EF Core).
- WKT-based geometry exchange between the API and the client.
- Map layers served from **GeoServer** over **WMS/WFS** and rendered with OpenLayers.

### Spatial analysis
- **Buffer analysis**, **heat maps** and **thematic maps**.
- Attribute and spatial filtering of layers (WFS + CQL filters).
- Location analysis panel and geometry query tools.

### Authentication & authorization
- **JWT** authentication with BCrypt password hashing.
- **Role-based access control (RBAC):** roles, permissions, role–permission and user–permission assignments.
- Per-layer **view / create / update / delete** permissions.
- **Geographic authorization:** each user can only view and manage data inside their assigned region.
- Admin panel for managing users, roles and permissions.
- **Self-service sign-up:** new accounts get a default `Kullanıcı` (user) role with drawing, analysis, POI and transit permissions.
- **Per-user data isolation:** every user sees and manages only their own POIs and transit data, enforced centrally with EF Core global query filters (spatial features are filtered per user in the services).
- User, role, permission and region management endpoints require an **Admin** role, checked on the server.

### Points of interest
- POI categories and POI search on the map.

### Public transportation
- Intercity **route and stop management** (route codes, stop types, ordered stops).
- Road-following route geometry generated with **OSRM**, plus a separate walking-profile OSRM for transfers.
- **Schedules and trips** with per-stop timing.
- **Journey planner** that combines transit trips with walking segments.
- **Built-in system lines** visible to every user (read-only) and usable in the journey planner:
  - **İstanbul metro:** M1A, M2, M3, M4, M5, M7, M8, M9, M11 — real track geometry and 180 stations from the İBB Open Data Portal.
  - **Ankara rail:** M1, M2, M3, M4 and Ankaray — from OpenStreetMap.
  - **Regional intercity tours:** Black Sea (18 provinces), Mediterranean (8) and Central Anatolia (13), one stop per province centre, road geometry generated with OSRM.
  - Loaded once at startup by `SystemLinesSeedService` from `Data/Seed/system-lines.json`, with daily schedules and trips in both directions.

### Real-time vehicle simulation
- Background service that simulates buses and metro vehicles along their routes with configurable speed, acceleration, braking and stop dwell time.
- Live vehicle positions pushed to the map via **SignalR** (WebSocket).

---

## Architecture

```
┌──────────────────────────┐        REST / JWT        ┌─────────────────────────────┐
│  React + OpenLayers UI   │ ───────────────────────▶ │   ASP.NET Core 8 Web API     │
│  (Vite)                  │ ◀─────── SignalR ─────── │   Controllers → Services     │
└──────────┬───────────────┘                          │   EF Core + NetTopologySuite │
           │ WMS / WFS                                └──────┬──────────────┬────────┘
           ▼                                                 │              │
┌──────────────────────────┐                                 ▼              ▼
│        GeoServer         │ ──────────────────────▶ ┌──────────────────┐ ┌──────────────┐
└──────────────────────────┘                         │ PostgreSQL       │ │ OSRM         │
                                                     │ + PostGIS        │ │ (car / walk) │
                                                     └──────────────────┘ └──────────────┘
```

The backend follows a layered structure: **Controllers** handle HTTP, **Services** (behind interfaces) contain business logic, and **Data** holds the EF Core `DbContext` and migrations.

---

## Live Deployment

| Part | Service |
|---|---|
| Frontend (React/Vite) | **Vercel** — `frontend/login-map-ui` |
| API (ASP.NET Core 8) | **Render**, Docker (`backend/LoginMapApi/Dockerfile`) |
| Database (PostgreSQL + PostGIS) | **Supabase** (Frankfurt) |
| Routing | Public OSRM servers at `routing.openstreetmap.de` (car and foot profiles) |

GeoServer is not deployed. When `VITE_ENABLE_GEOSERVER=false`, the frontend loads POIs directly from the API and builds the heat map in the browser from the user's own geometries; GeoServer WMS layers are not available.

**Environment variables**

| Where | Variable | Purpose |
|---|---|---|
| Render | `ConnectionStrings__DefaultConnection` | PostgreSQL connection string (Supabase session pooler) |
| Render | `Jwt__Key` | JWT signing key (at least 32 characters) |
| Render | `Cors__AllowedOrigins` | Allowed frontend origins, comma-separated |
| Render | `Osrm__BaseUrl`, `WalkingOsrm__BaseUrl` | OSRM car and foot servers |
| Render | `GeoServer__BaseUrl` | GeoServer address (optional) |
| Vercel | `VITE_API_BASE_URL` | API address |
| Vercel | `VITE_ENABLE_GEOSERVER` | `false` when GeoServer is not available |

Free-tier notes: the Render instance sleeps after 15 minutes of inactivity, Supabase pauses a project after a week without activity, and uploaded profile images are not persisted across API restarts.

---

## Data Model

17 tables managed with EF Core migrations:

| Area | Tables |
|---|---|
| Spatial features | `Points`, `Lines`, `Polygons` |
| Users & access | `Users`, `Roles`, `Permissions`, `UserRoles`, `RolePermissions`, `UserPermissions`, `GeographicAuthorizations` |
| Points of interest | `Pois`, `PoiCategories` |
| Transportation | `TransitRoutes`, `TransitStops`, `TransitSchedules`, `TransitTrips`, `TransitTripStops` |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Backend | ASP.NET Core 8 Web API, Entity Framework Core 8, NetTopologySuite, SignalR, JWT Bearer, BCrypt, Swagger |
| Database | PostgreSQL, PostGIS |
| Map services | GeoServer (WMS/WFS) |
| Routing | OSRM |
| Frontend | React 19, Vite, OpenLayers 10, React Router, @microsoft/signalr |

---

## Project Structure

```
backend/LoginMapApi/
├── Controllers/        # REST endpoints (auth, geometry, RBAC, POI, transit, GeoServer)
├── Services/           # Business logic + Interfaces/
├── Models/             # Entities and DTOs
├── Data/               # AppDbContext
├── Data/Seed/          # system-lines.json (İstanbul/Ankara rail, regional tours)
├── Hubs/               # SignalR VehicleHub
├── Security/           # AdminOnly filter (server-side admin check)
├── Migrations/         # EF Core migrations
├── Dockerfile
└── appsettings.json

frontend/login-map-ui/src/
├── pages/
│   ├── LoginPage.jsx
│   ├── AdminPage.jsx
│   ├── MapPage.jsx
│   └── MapPage/        # Layer control, query, thematic map, transit, POI panels
└── services/signalR.js
```

---

## Getting Started

### Prerequisites
- .NET 8 SDK
- Node.js 18+
- PostgreSQL with the PostGIS extension
- GeoServer (connected to the same PostGIS database)
- OSRM running locally (car profile on port `5001`, walking profile on port `5002`)

### 1. Configure the backend

Fill in `backend/LoginMapApi/appsettings.json`:

```json
"ConnectionStrings": {
  "DefaultConnection": "Host=localhost;Database=gis_db;Username=postgres;Password=YOUR_PASSWORD"
},
"Jwt": {
  "Key": "YOUR_LONG_RANDOM_SECRET_KEY"
}
```

### 2. Create the database and run the API

```bash
cd backend/LoginMapApi
dotnet ef database update
dotnet run
```

The API runs on `http://localhost:5075`.

> Note: the `Users`, `Points`, `Lines` and `Polygons` tables predate the EF Core migrations, so on an empty database restore a `pg_dump` of an existing database instead of running the migrations alone.

### 3. Run the frontend

```bash
cd frontend/login-map-ui
npm install
npm run dev
```

---

## Configuration

Vehicle simulation and journey planner behaviour can be tuned in `appsettings.json`:

| Setting | Default |
|---|---|
| `VehicleSimulation:BusMaxSpeedKmh` | 50 |
| `VehicleSimulation:MetroMaxSpeedKmh` | 80 |
| `VehicleSimulation:StopDwellSeconds` | 10 |
| `VehicleSimulation:TimeScale` | 20 |
| `TransitJourneyPlanner:MaximumWalkingDistanceMeters` | 5000 |

---

## Data Sources

- İstanbul rail lines and stations: [İBB Open Data Portal](https://data.ibb.gov.tr) (Raylı Sistem Hatları, Raylı Sistem İstasyon Noktaları).
- Ankara rail lines and stations, road and walking routes: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL), routing via OSRM.

---

## Author

**Furkan Canik**: [GitHub](https://github.com/furkancanik) · [LinkedIn](https://www.linkedin.com/in/furkan-canik/)

Developed as an independent project during the Başarsoft POI Internship Program.
