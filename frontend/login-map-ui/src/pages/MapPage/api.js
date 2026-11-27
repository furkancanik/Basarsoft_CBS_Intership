export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5075";

export const getAuthConfig = () => {
  const token = localStorage.getItem("token");

  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
};

export const getApiUrl = (type, id = null) => {
  const endpointMap = {
    Point: "points",
    Line: "lines",
    LineString: "lines",
    Polygon: "polygons",
  };

  const endpoint = endpointMap[type];

  if (!endpoint) {
    throw new Error(`Geçersiz geometri tipi: ${type}`);
  }

  const baseUrl = `${API_BASE_URL}/api/${endpoint}`;

  return id !== null && id !== undefined
    ? `${baseUrl}/${id}`
    : baseUrl;
};

export const TRANSIT_ROUTES_API_URL =
  `${API_BASE_URL}/api/TransitRoutes`;

export const TRANSIT_STOPS_API_URL =
  `${API_BASE_URL}/api/TransitStops`;

export const getTransitRouteUrl = (id = null) => {
  return id !== null && id !== undefined
    ? `${TRANSIT_ROUTES_API_URL}/${id}`
    : TRANSIT_ROUTES_API_URL;
};

export const getTransitStopUrl = (id = null) => {
  return id !== null && id !== undefined
    ? `${TRANSIT_STOPS_API_URL}/${id}`
    : TRANSIT_STOPS_API_URL;
};