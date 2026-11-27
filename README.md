# Turkey-Wide GIS Coordination Platform

A web-based Geographic Information System (GIS) developed during my internship at **Başarsoft Bilgi Teknolojileri A.Ş.** (POI Internship Program, 2026). The platform lets organizations manage spatial data, regional access, points of interest and intercity public transportation on a single interactive map.

> Built with **ASP.NET Core 8**, **React**, **OpenLayers**, **PostgreSQL/PostGIS**, **GeoServer**, **OSRM** and **SignalR**.

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

### Points of interest
- POI categories and POI search on the map.

### Public transportation
- Intercity **route and stop management** (route codes, stop types, ordered stops).
- Road-following route geometry generated with **OSRM**, plus a separate walking-profile OSRM for transfers.
- **Schedules and trips** with per-stop timing.
- **Journey planner** that combines transit trips with walking segments.

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
├── Hubs/               # SignalR VehicleHub
├── Migrations/         # EF Core migrations
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

The API runs on `http://localhost:5075` (Swagger: `http://localhost:5075/swagger`).

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

## Author

**Furkan Canik**: [GitHub](https://github.com/furkancanik) · [LinkedIn](https://www.linkedin.com/in/furkan-canik/)

Developed as an independent project during the Başarsoft POI Internship Program.
