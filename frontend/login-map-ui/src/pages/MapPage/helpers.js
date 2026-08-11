export const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getHiddenItems = () => {
  return JSON.parse(localStorage.getItem("hiddenGeometries") || "[]");
};

export const setHiddenItems = (items) => {
  localStorage.setItem("hiddenGeometries", JSON.stringify(items));
};

export const getGeometryName = (pendingData) => {
  if (!pendingData) return "";
  if (pendingData.type === "Point") return "Point";
  if (pendingData.type === "LineString") return "Line";
  if (pendingData.type === "Polygon") return "Polygon";

  return pendingData.type;
};

export const getInfoTitle = (pendingData) => {
  if (pendingData?.originalType === "Point") return "Point Bilgileri";
  if (pendingData?.originalType === "LineString") return "Line Bilgileri";
  if (pendingData?.originalType === "Polygon") return "Polygon Bilgileri";

  return "";
};