// Ortam ayarları (Vite). Değerler .env dosyalarından gelir.
// Tanımlı değilse yerel geliştirme varsayılanları kullanılır.

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5075";

// GeoServer kullanılabilir mi? Canlıda yok: POI doğrudan API'den yüklenir,
// ısı haritası tarayıcıda üretilir (VITE_ENABLE_GEOSERVER=false).
export const GEOSERVER_ENABLED =
  import.meta.env.VITE_ENABLE_GEOSERVER !== "false";
