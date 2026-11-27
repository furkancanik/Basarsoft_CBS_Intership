// Ortam ayarları (Vite). Değerler .env dosyalarından gelir.
// Tanımlı değilse yerel geliştirme varsayılanları kullanılır.

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5075";

// GeoServer'a bağlı özellikler (POI katmanı, Sorgulama, Isı haritası).
// Canlı sürümde GeoServer olmadığı için VITE_ENABLE_GEOSERVER=false ile gizlenir.
export const GEOSERVER_ENABLED =
  import.meta.env.VITE_ENABLE_GEOSERVER !== "false";
