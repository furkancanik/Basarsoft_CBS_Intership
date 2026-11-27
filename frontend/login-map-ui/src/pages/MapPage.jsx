import { useEffect, useRef, useState } from "react";
import axios from "axios";

import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import GeoJSON from "ol/format/GeoJSON";
import PoiSearchBar from "./MapPage/PoiSearchBar";


import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import HeatmapLayer from "ol/layer/Heatmap";
import Draw from "ol/interaction/Draw";
import Translate from "ol/interaction/Translate";
import Collection from "ol/Collection";
import TileWMS from "ol/source/TileWMS";
import LocationAnalysisPanel from "./MapPage/LocationAnalysisPanel";
import TransitRoutesPanel from "./MapPage/TransitRoutesPage";
import TripManagementPanel from "./MapPage/TripManagementPanel";
import TransitJourneyPanel from "./MapPage/TransitJourneyPanel";
import ThematicMapPanel from "./MapPage/ThematicMapPanel";
import {
  getVehicleConnection,
  joinVehicleRoute,
  leaveVehicleRoute,
  startVehicleConnection,
  stopVehicleConnection,
} from "../services/signalR";

import WKT from "ol/format/WKT";
import { fromLonLat, toLonLat } from "ol/proj";
import { getDistance } from "ol/sphere";

import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";
import CircleStyle from "ol/style/Circle";
import Icon from "ol/style/Icon";
import Text from "ol/style/Text";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import LineString from "ol/geom/LineString";
import CircleGeometry from "ol/geom/Circle";

import "ol/ol.css";

import styles from "./MapPage/styles";
import Topbar from "./MapPage/Topbar";
import GeometryPopup from "./MapPage/GeometryPopup";
import QueryPanel from "./MapPage/QueryPanel";
import { GEOSERVER_ENABLED } from "../config";

import { API_BASE_URL, getAuthConfig, getApiUrl } from "./MapPage/api";
import {
  hexToRgba,
  getHiddenItems,
  setHiddenItems,
  getGeometryName,
  getInfoTitle,
} from "./MapPage/helpers";

const GEOSERVER_WFS_URL = "/geoserver/staj/ows";
const GEOSERVER_WMS_URL = "/geoserver/staj/wms";
const GEOSERVER_LAYERS = [
  { layerName: "Points", type: "Point" },
  { layerName: "Lines", type: "LineString" },
  { layerName: "Polygons", type: "Polygon" },
];

const MAP_PAGE_STATE_KEY = "mapPagePersistentState";

const DEFAULT_MAP_PAGE_STATE = {
  center: fromLonLat([35, 39]),
  zoom: 6,
  visibleLayers: {
    Point: true,
    LineString: true,
    Polygon: true,
  },
  showOnlyOpenPois: false,
  selectedPoiCategories: [],
  visibleTransitStopTypes: {
    Bus: true,
    Metro: true,
  },
  hiddenTransitRouteIds: [],
};

const readMapPageState = () => {
  try {
    const rawValue = localStorage.getItem(MAP_PAGE_STATE_KEY);

    if (!rawValue) {
      return DEFAULT_MAP_PAGE_STATE;
    }

    const parsedValue = JSON.parse(rawValue);

    const center =
      Array.isArray(parsedValue?.center) &&
      parsedValue.center.length >= 2 &&
      Number.isFinite(Number(parsedValue.center[0])) &&
      Number.isFinite(Number(parsedValue.center[1]))
        ? [
            Number(parsedValue.center[0]),
            Number(parsedValue.center[1]),
          ]
        : DEFAULT_MAP_PAGE_STATE.center;

    const zoom = Number.isFinite(Number(parsedValue?.zoom))
      ? Number(parsedValue.zoom)
      : DEFAULT_MAP_PAGE_STATE.zoom;

    return {
      center,
      zoom,
      visibleLayers: {
        Point:
          parsedValue?.visibleLayers?.Point !== false,
        LineString:
          parsedValue?.visibleLayers?.LineString !== false,
        Polygon:
          parsedValue?.visibleLayers?.Polygon !== false,
      },
      showOnlyOpenPois:
        parsedValue?.showOnlyOpenPois === true,
      selectedPoiCategories: Array.isArray(
        parsedValue?.selectedPoiCategories
      )
        ? parsedValue.selectedPoiCategories
        : [],
      visibleTransitStopTypes: {
        Bus:
          parsedValue?.visibleTransitStopTypes?.Bus !== false,
        Metro:
          parsedValue?.visibleTransitStopTypes?.Metro !== false,
      },
      hiddenTransitRouteIds: Array.isArray(
        parsedValue?.hiddenTransitRouteIds
      )
        ? parsedValue.hiddenTransitRouteIds
            .map((routeId) => Number(routeId))
            .filter(
              (routeId) =>
                Number.isInteger(routeId) && routeId > 0
            )
        : [],
    };
  } catch (error) {
    console.warn(
      "Kayıtlı harita görünümü okunamadı:",
      error
    );

    return DEFAULT_MAP_PAGE_STATE;
  }
};

const writeMapPageState = (partialState) => {
  try {
    const currentState = readMapPageState();

    localStorage.setItem(
      MAP_PAGE_STATE_KEY,
      JSON.stringify({
        ...currentState,
        ...partialState,
      })
    );
  } catch (error) {
    console.warn(
      "Harita görünümü kaydedilemedi:",
      error
    );
  }
};


const formatPoiCreatedDate = (value) => {
  if (!value) return "-";

  try {
    const rawValue = String(value).trim();

    const hasTimezone =
      rawValue.endsWith("Z") ||
      /[+-]\d{2}:?\d{2}$/.test(rawValue);

    const normalizedValue = hasTimezone
      ? rawValue
      : `${rawValue}Z`;

    const date = new Date(normalizedValue);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return "-";
  }
};

const getPoiCategoryIcon = (categoryName) => {
  const normalizedName = String(categoryName || "")
    .trim()
    .toLocaleLowerCase("tr-TR");

  if (normalizedName.includes("ulaşım")) return "🚇";
  if (normalizedName.includes("sağlık")) return "⚕";
  if (normalizedName.includes("eğitim")) return "🎓";
  if (
    normalizedName.includes("yeme") ||
    normalizedName.includes("içme") ||
    normalizedName.includes("restoran") ||
    normalizedName.includes("kafe")
  ) {
    return "🍽";
  }

  return "📍";
};

const getPoiCategoryTheme = (categoryName) => {
  const normalizedName = String(categoryName || "")
    .trim()
    .toLocaleLowerCase("tr-TR");

  if (normalizedName.includes("ulaşım")) {
    return {
      cardBackground:
        "linear-gradient(145deg, rgba(7,28,55,0.98), rgba(10,52,86,0.98))",
      borderColor: "rgba(56,189,248,0.30)",
      badgeBackground: "rgba(14,165,233,0.16)",
      badgeBorder: "rgba(125,211,252,0.28)",
      badgeText: "#bae6fd",
      iconBackground: "rgba(255,255,255,0.10)",
      iconBorder: "rgba(186,230,253,0.28)",
      titleColor: "#f8fafc",
      mutedColor: "#94a3b8",
      hourColor: "#ffffff",
      accentColor: "#38bdf8",
      detailBorder: "rgba(186,230,253,0.15)",
      detailLabel: "#94a3b8",
      detailValue: "#e0f2fe",
      buttonBackground: "rgba(3,105,161,0.72)",
      buttonBorder: "rgba(125,211,252,0.28)",
    };
  }

  if (normalizedName.includes("sağlık")) {
    return {
      cardBackground:
        "linear-gradient(145deg, rgba(9,42,42,0.98), rgba(15,74,67,0.98))",
      borderColor: "rgba(45,212,191,0.30)",
      badgeBackground: "rgba(20,184,166,0.16)",
      badgeBorder: "rgba(94,234,212,0.28)",
      badgeText: "#99f6e4",
      iconBackground: "rgba(255,255,255,0.10)",
      iconBorder: "rgba(153,246,228,0.28)",
      titleColor: "#f8fafc",
      mutedColor: "#94a3b8",
      hourColor: "#ffffff",
      accentColor: "#2dd4bf",
      detailBorder: "rgba(153,246,228,0.15)",
      detailLabel: "#94a3b8",
      detailValue: "#ccfbf1",
      buttonBackground: "rgba(15,118,110,0.74)",
      buttonBorder: "rgba(94,234,212,0.28)",
    };
  }

  if (normalizedName.includes("eğitim")) {
    return {
      cardBackground:
        "linear-gradient(145deg, rgba(31,24,68,0.98), rgba(67,56,202,0.92))",
      borderColor: "rgba(167,139,250,0.32)",
      badgeBackground: "rgba(139,92,246,0.17)",
      badgeBorder: "rgba(196,181,253,0.28)",
      badgeText: "#ddd6fe",
      iconBackground: "rgba(255,255,255,0.10)",
      iconBorder: "rgba(221,214,254,0.28)",
      titleColor: "#f8fafc",
      mutedColor: "#a5b4fc",
      hourColor: "#ffffff",
      accentColor: "#a78bfa",
      detailBorder: "rgba(221,214,254,0.15)",
      detailLabel: "#a5b4fc",
      detailValue: "#ede9fe",
      buttonBackground: "rgba(79,70,229,0.74)",
      buttonBorder: "rgba(196,181,253,0.28)",
    };
  }

  if (
    normalizedName.includes("yeme") ||
    normalizedName.includes("içme") ||
    normalizedName.includes("restoran") ||
    normalizedName.includes("kafe")
  ) {
    return {
      cardBackground:
        "linear-gradient(145deg, rgba(60,28,10,0.98), rgba(120,53,15,0.95))",
      borderColor: "rgba(251,146,60,0.30)",
      badgeBackground: "rgba(249,115,22,0.17)",
      badgeBorder: "rgba(253,186,116,0.28)",
      badgeText: "#fed7aa",
      iconBackground: "rgba(255,255,255,0.10)",
      iconBorder: "rgba(254,215,170,0.28)",
      titleColor: "#fff7ed",
      mutedColor: "#fdba74",
      hourColor: "#ffffff",
      accentColor: "#fb923c",
      detailBorder: "rgba(254,215,170,0.15)",
      detailLabel: "#fdba74",
      detailValue: "#ffedd5",
      buttonBackground: "rgba(194,65,12,0.76)",
      buttonBorder: "rgba(253,186,116,0.28)",
    };
  }

  return {
    cardBackground:
      "linear-gradient(145deg, rgba(7,18,42,0.99), rgba(15,42,86,0.98))",
    borderColor: "rgba(96,165,250,0.28)",
    badgeBackground: "rgba(37,99,235,0.16)",
    badgeBorder: "rgba(147,197,253,0.28)",
    badgeText: "#bfdbfe",
    iconBackground: "rgba(255,255,255,0.10)",
    iconBorder: "rgba(191,219,254,0.28)",
    titleColor: "#f8fafc",
    mutedColor: "#94a3b8",
    hourColor: "#ffffff",
    accentColor: "#60a5fa",
    detailBorder: "rgba(191,219,254,0.15)",
    detailLabel: "#94a3b8",
    detailValue: "#dbeafe",
    buttonBackground: "rgba(30,64,175,0.72)",
    buttonBorder: "rgba(147,197,253,0.28)",
  };
};


const parsePoiTimeToMinutes = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const timeText = String(value).trim();
  const match = timeText.match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
};

const isPoiOpenNow = (openingTime, closingTime, currentDate = new Date()) => {
  const openingMinutes = parsePoiTimeToMinutes(openingTime);
  const closingMinutes = parsePoiTimeToMinutes(closingTime);

  if (openingMinutes === null || closingMinutes === null) {
    return false;
  }

  const currentMinutes =
    currentDate.getHours() * 60 + currentDate.getMinutes();

  // Aynı açılış ve kapanış saati 24 saat açık olarak değerlendirilir.
  if (openingMinutes === closingMinutes) {
    return true;
  }

  // Aynı gün içinde açılıp kapanan POI: 09:00 - 18:00
  if (openingMinutes < closingMinutes) {
    return (
      currentMinutes >= openingMinutes &&
      currentMinutes < closingMinutes
    );
  }

  // Gece yarısını geçen çalışma aralığı: 20:00 - 02:00
  return (
    currentMinutes >= openingMinutes ||
    currentMinutes < closingMinutes
  );
};


const createVehicleIconDataUri = (vehicleType, routeColor = "#2563eb") => {
  const normalizedVehicleType =
    String(vehicleType || "Bus").toLowerCase() === "metro"
      ? "Metro"
      : "Bus";

  const safeRouteColor = /^#[0-9a-fA-F]{6}$/.test(String(routeColor || ""))
    ? routeColor
    : normalizedVehicleType === "Metro"
      ? "#7c3aed"
      : "#2563eb";

  const svgMarkup =
    normalizedVehicleType === "Metro"
      ? `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="metroBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#ffffff"/>
              <stop offset="1" stop-color="#dbeafe"/>
            </linearGradient>
            <linearGradient id="metroGlass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#1e293b"/>
              <stop offset="1" stop-color="#0f172a"/>
            </linearGradient>
          </defs>
          <path d="M28 16C37 7 83 7 92 16c10 12 14 70 3 84-9 11-61 11-70 0-11-14-7-72 3-84Z" fill="url(#metroBody)" stroke="${safeRouteColor}" stroke-width="8"/>
          <path d="M36 28c8-7 40-7 48 0l5 31H31l5-31Z" fill="url(#metroGlass)"/>
          <path d="M34 69h52l-7 18H41l-7-18Z" fill="${safeRouteColor}" opacity=".92"/>
          <circle cx="43" cy="92" r="7" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
          <circle cx="77" cy="92" r="7" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
          <path d="M42 108l-8 8M78 108l8 8" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>
        </svg>`
      : `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="busBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="${safeRouteColor}"/>
              <stop offset="1" stop-color="#1d4ed8"/>
            </linearGradient>
            <linearGradient id="busGlass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#334155"/>
              <stop offset="1" stop-color="#0f172a"/>
            </linearGradient>
          </defs>
          <rect x="25" y="13" width="70" height="91" rx="24" fill="url(#busBody)" stroke="#ffffff" stroke-width="5"/>
          <rect x="34" y="25" width="52" height="35" rx="10" fill="url(#busGlass)"/>
          <rect x="36" y="67" width="48" height="16" rx="4" fill="#dbeafe" opacity=".95"/>
          <rect x="17" y="35" width="12" height="31" rx="6" fill="${safeRouteColor}"/>
          <rect x="91" y="35" width="12" height="31" rx="6" fill="${safeRouteColor}"/>
          <circle cx="43" cy="92" r="7" fill="#f8fafc"/>
          <circle cx="77" cy="92" r="7" fill="#f8fafc"/>
          <path d="M43 105v8M77 105v8" stroke="#0f172a" stroke-width="7" stroke-linecap="round"/>
        </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    svgMarkup.replace(/\s{2,}/g, " ").trim()
  )}`;
};


const normalizeDrawingRoleName = (value) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, "");

const splitDrawingRoleValues = (value) => {
  if (Array.isArray(value)) {
    return value.flatMap(splitDrawingRoleValues);
  }

  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === "object") {
    return Object.values(value).flatMap(splitDrawingRoleValues);
  }

  const textValue = String(value).trim();

  if (!textValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(textValue);

    if (Array.isArray(parsedValue) || typeof parsedValue === "object") {
      return splitDrawingRoleValues(parsedValue);
    }
  } catch {
    // Normal metin değeridir.
  }

  return textValue
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const getDrawingRoleNamesFromToken = () => {
  const token = localStorage.getItem("token");

  if (!token) {
    return [];
  }

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const roleValues = [];

    Object.entries(payload || {}).forEach(([claimName, claimValue]) => {
      const normalizedClaimName = String(claimName || "")
        .toLocaleLowerCase("tr-TR");

      if (
        normalizedClaimName === "role" ||
        normalizedClaimName === "roles" ||
        normalizedClaimName.endsWith("/role") ||
        normalizedClaimName.includes("claims/role")
      ) {
        roleValues.push(...splitDrawingRoleValues(claimValue));
      }
    });

    return roleValues;
  } catch (error) {
    console.warn("JWT rol bilgisi okunamadı:", error);
    return [];
  }
};

const hasUnlimitedMapDrawingRole = (roleNames = []) =>
  roleNames.some((roleName) => {
    const normalizedRoleName = normalizeDrawingRoleName(roleName);

    return (
      normalizedRoleName === "admin" ||
      normalizedRoleName === "administrator" ||
      normalizedRoleName === "operatör" ||
      normalizedRoleName === "operator" ||
      // Veriler kullanıcıya özel olduğu için Kullanıcı rolü de
      // bölge kısıtı olmadan çizim yapabilir.
      normalizedRoleName === "kullanıcı" ||
      normalizedRoleName === "kullanici"
    );
  });

function MapPage() {
  const initialMapPageStateRef = useRef(
    readMapPageState()
  );

  /*
    Admin ve Operatör rolleri coğrafi yetki alanından bağımsız olarak
    haritanın tamamında çizim yapabilir. İlk değer JWT içindeki rol
    claim'lerinden senkron olarak okunur; aşağıdaki API kontrolü de
    eksik JWT rol claim'i ihtimaline karşı bunu doğrular.
  */
  const hasGlobalDrawingAccessRef = useRef(
    hasUnlimitedMapDrawingRole(
      getDrawingRoleNamesFromToken()
    )
  );

  const mapRef = useRef();
  const drawRef = useRef(null);
  const mapObjectRef = useRef(null);
  const sourceRef = useRef(null);
  const poiSourceRef = useRef(null);
  const poiLayerRef = useRef(null);
  const transitStopSourceRef = useRef(null);
  const transitStopLayerRef = useRef(null);
  const transitRouteLineSourceRef = useRef(null);
  const transitRouteLineLayerRef = useRef(null);
  const vehicleSourceRef = useRef(null);
  const vehicleLayerRef = useRef(null);
  const vehicleAnimationFramesRef = useRef(new globalThis.Map());
  const vehicleLastUpdateTimesRef = useRef(new globalThis.Map());
  const joinedVehicleRouteIdsRef = useRef(new Set());
  const selectedVehicleSimulationIdRef = useRef(null);
  const followingVehicleSimulationIdRef = useRef(null);
  const authAreaSourceRef = useRef(null);
  const modifyRef = useRef(null);
  const isGeometryEditingRef = useRef(false);
  const activeToolRef = useRef("");
  const suppressMapClickRef = useRef(false);
  const heatmapLayerRef = useRef([]);
  const pointWmsLayerRef = useRef(null);
  const locationAnalysisSourceRef = useRef(null);
  const locationAnalysisLayerRef = useRef(null);
  const locationAnalysisAreaRef = useRef(null);
  const transitJourneySourceRef = useRef(null);
  const transitJourneyLayerRef = useRef(null);
  const transitJourneySelectionModeRef = useRef("");
  const transitJourneyStartPointRef = useRef(null);
  const transitJourneyEndPointRef = useRef(null);
  const thematicLayerRefs = useRef({
    stopHeatmap: null,
    poiHeatmap: null,
    walkingAccess: null,
    poiAccessibility: null,
    routeCoverage: null,
  });
  const locationAnalysisHeatmapLayerRef = useRef(null);
  const showOnlyOpenPoisRef = useRef(false);
  const selectedPoiCategoriesRef = useRef([]);
  const visibleTransitStopTypesRef = useRef({
    ...initialMapPageStateRef.current
      .visibleTransitStopTypes,
  });
  const hiddenTransitRouteIdsRef = useRef(
    new Set(
      initialMapPageStateRef.current
        .hiddenTransitRouteIds || []
    )
  );

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(5 * 60);
  const [activeTool, setActiveTool] = useState("");
  const [username, setUsername] = useState("");
  const [profileImage, setProfileImage] = useState("");

  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [queryPanelOpen, setQueryPanelOpen] = useState(false);
  const [transitRoutesPanelOpen, setTransitRoutesPanelOpen] =
    useState(false);
  const [tripManagementPanelOpen, setTripManagementPanelOpen] =
    useState(false);
  const [transitJourneyPanelOpen, setTransitJourneyPanelOpen] =
    useState(false);
  const [transitJourneyStartPoint, setTransitJourneyStartPoint] =
    useState(null);
  const [transitJourneyEndPoint, setTransitJourneyEndPoint] =
    useState(null);
  const [transitJourneySelectionMode, setTransitJourneySelectionMode] =
    useState("");

  useEffect(() => {
    transitJourneyStartPointRef.current =
      transitJourneyStartPoint;
  }, [transitJourneyStartPoint]);

  useEffect(() => {
    transitJourneyEndPointRef.current =
      transitJourneyEndPoint;
  }, [transitJourneyEndPoint]);
  const [thematicMapPanelOpen, setThematicMapPanelOpen] =
    useState(false);
  const [thematicThemes, setThematicThemes] = useState({
    stopHeatmap: false,
    poiHeatmap: false,
    walkingAccess: false,
    poiAccessibility: false,
    routeCoverage: false,
  });
  const [locationAnalysisOpen, setLocationAnalysisOpen] =
    useState(false);
  const [locationAnalysisAreaWkt, setLocationAnalysisAreaWkt] = useState("");
  const [locationAnalysisAreaSelected, setLocationAnalysisAreaSelected] =
    useState(false);
  const [locationAnalysisRunning, setLocationAnalysisRunning] = useState(false);
  const [locationAnalysisPoiCount, setLocationAnalysisPoiCount] = useState(0);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [overlapModalOpen, setOverlapModalOpen] = useState(false);
  const [overlapFeatures, setOverlapFeatures] = useState([]);

  const [isGeometryEditingOnMap, setIsGeometryEditingOnMap] = useState(false);
  const [editOriginalWkt, setEditOriginalWkt] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [regionWarningOpen, setRegionWarningOpen] = useState(false);

  const [visibleLayers, setVisibleLayers] = useState(
    initialMapPageStateRef.current.visibleLayers
  );
  const [visiblePois, setVisiblePois] = useState(true);

  const [popupOpen, setPopupOpen] = useState(false);
  const [pendingData, setPendingData] = useState(null);

  const [inventoryCount, setInventoryCount] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [poiPopupOpen, setPoiPopupOpen] = useState(false);
const [poiInfoOpen, setPoiInfoOpen] = useState(false);
const [poiInfoDetailsOpen, setPoiInfoDetailsOpen] = useState(false);
const [poiCategories, setPoiCategories] = useState([]);
const [pendingPoiFeature, setPendingPoiFeature] = useState(null);
const [selectedPoi, setSelectedPoi] = useState(null);
const [isSavingPoi, setIsSavingPoi] = useState(false);

/*
 * Yol tarifi panelindeki POI -> POI seçimi için kullanılan
 * sadeleştirilmiş POI listesi.
 *
 * OpenLayers Feature nesnelerini panel içine taşımak yerine
 * yalnızca gerekli alanları gönderiyoruz.
 */
const [journeyPoiOptions, setJourneyPoiOptions] = useState([]);
const [showOnlyOpenPois, setShowOnlyOpenPois] = useState(
  initialMapPageStateRef.current.showOnlyOpenPois
);
const [selectedPoiCategories, setSelectedPoiCategories] = useState(
  initialMapPageStateRef.current.selectedPoiCategories
);

const [transitRoutes, setTransitRoutes] = useState([]);
const [hiddenTransitRouteIds, setHiddenTransitRouteIds] = useState(
  initialMapPageStateRef.current.hiddenTransitRouteIds || []
);
const [visibleTransitStopTypes, setVisibleTransitStopTypes] = useState(
  initialMapPageStateRef.current.visibleTransitStopTypes
);
const [transitStopPopupOpen, setTransitStopPopupOpen] = useState(false);
const [transitStopInfoOpen, setTransitStopInfoOpen] = useState(false);
const [pendingTransitStopFeature, setPendingTransitStopFeature] = useState(null);
const [selectedTransitStop, setSelectedTransitStop] = useState(null);
const [isSavingTransitStop, setIsSavingTransitStop] = useState(false);
const [vehicleInfoOpen, setVehicleInfoOpen] = useState(false);
const [selectedVehicle, setSelectedVehicle] = useState(null);
const [followingVehicleSimulationId, setFollowingVehicleSimulationId] = useState(null);
const [transitStopForm, setTransitStopForm] = useState({
  name: "",
  transitRouteId: "",
  stopType: "Bus",
});

const [poiForm, setPoiForm] = useState({
  name: "",
  parentCategoryId: "",
  poiCategoryId: "",
  openingTime: "09:00",
  closingTime: "18:00",
});
  

  const [form, setForm] = useState({
    name: "",
    color: "#2563eb",
    description: "",
  });

  const createFeatureStyle = (type, color) => {
    if (type === "Point") {
      return new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color }),
        }),
      });
    }

    if (type === "LineString") {
      return new Style({
        stroke: new Stroke({ color, width: 4 }),
      });
    }

    if (type === "Polygon") {
      return new Style({
        stroke: new Stroke({ color, width: 3 }),
        fill: new Fill({ color: hexToRgba(color, 0.22) }),
      });
    }

    if (type === "Inventory") {
      return new Style({
        stroke: new Stroke({ color: "#1e40af", width: 4 }),
        fill: new Fill({ color: "rgba(30,64,175,0.16)" }),
      });
    }

    if (type === "LocationAnalysisArea") {
      return new Style({
        stroke: new Stroke({
          color: "rgba(56, 189, 248, 0.92)",
          width: 2.5,
          lineDash: [10, 7],
        }),
        fill: new Fill({
          color: "rgba(56, 189, 248, 0.035)",
        }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({
            color: "#38bdf8",
          }),
        }),
      });
    }

    if (type === "AuthorizedArea") {
      return new Style({
        stroke: new Stroke({
          color: "#38bdf8",
          width: 3,
          lineDash: [10, 8],
        }),
        fill: new Fill({
          color: "rgba(56, 189, 248, 0.12)",
        }),
      });
    }

    return null;
  };


  const createLocationAnalysisResultAreaStyle = () => {
    return new Style({
      stroke: new Stroke({
        color: "rgba(255, 255, 255, 0.92)",
        width: 2.2,
        lineDash: [10, 8],
      }),
      fill: new Fill({
        color: "rgba(255, 255, 255, 0.008)",
      }),
    });
  };

  const getPoiMapMarker = (categoryName) => {
    const normalizedName = String(categoryName || "")
      .trim()
      .toLocaleLowerCase("tr-TR");

    if (normalizedName.includes("ulaşım")) {
      return {
        icon: "🚇",
        backgroundColor: "#0284c7",
      };
    }

    if (normalizedName.includes("sağlık")) {
      return {
        icon: "⚕",
        backgroundColor: "#0f766e",
      };
    }

    if (normalizedName.includes("eğitim")) {
      return {
        icon: "🎓",
        backgroundColor: "#6d28d9",
      };
    }

    if (
      normalizedName.includes("yeme") ||
      normalizedName.includes("içme") ||
      normalizedName.includes("restoran") ||
      normalizedName.includes("kafe")
    ) {
      return {
        icon: "🍽",
        backgroundColor: "#c2410c",
      };
    }

    if (normalizedName.includes("alışveriş")) {
      return {
        icon: "🛍",
        backgroundColor: "#db2777",
      };
    }

    if (normalizedName.includes("konaklama")) {
      return {
        icon: "🏨",
        backgroundColor: "#7c3aed",
      };
    }

    if (normalizedName.includes("spor")) {
      return {
        icon: "⚽",
        backgroundColor: "#15803d",
      };
    }

    if (
      normalizedName.includes("turizm") ||
      normalizedName.includes("eğlence")
    ) {
      return {
        icon: "🎡",
        backgroundColor: "#d97706",
      };
    }

    if (normalizedName.includes("kamu")) {
      return {
        icon: "🏛",
        backgroundColor: "#475569",
      };
    }

    return {
      icon: "📍",
      backgroundColor: "#1d4ed8",
    };
  };

  const createPoiStyle = (
    categoryName = "",
    poiName = "",
    showName = false
  ) => {
    const marker = getPoiMapMarker(categoryName);

    const stylesList = [
      // Son küçük boyut korunuyor; yalnızca kategori ikonları
      // kullanıcının gönderdiği emoji ikonlarla gösteriliyor.
      new Style({
        image: new CircleStyle({
          radius: 8.5,
          fill: new Fill({
            color: marker.backgroundColor,
          }),
          stroke: new Stroke({
            color: "#ffffff",
            width: 1.6,
          }),
        }),

        text: new Text({
          text: marker.icon,
          font:
            '600 9px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
          textAlign: "center",
          textBaseline: "middle",
          offsetY: 0.5,
        }),

        zIndex: 100,
      }),
    ];

    if (showName && poiName) {
      stylesList.push(
        new Style({
          text: new Text({
            text: String(poiName),
            font:
              '600 10.5px "Inter", "Segoe UI", Arial, sans-serif',
            offsetY: -18,
            textAlign: "center",
            textBaseline: "bottom",
            padding: [2, 4, 2, 4],
            fill: new Fill({
              color: "#0f172a",
            }),
            stroke: new Stroke({
              color: "rgba(255,255,255,0.98)",
              width: 3,
            }),
          }),
          zIndex: 101,
        })
      );
    }

    return stylesList;
  };

  const createTransitStopStyle = (
    routeColor = "#2563eb",
    stopName = "",
    showName = false,
    stopType = "Bus",
    routeShortCode = ""
  ) => {
    const normalizedStopType =
      String(stopType || "Bus").toLowerCase() === "metro"
        ? "Metro"
        : "Bus";

    const normalizedShortCode = String(routeShortCode || "")
      .trim()
      .toUpperCase()
      .slice(0, 4);

    const stopIcon =
      normalizedShortCode ||
      (normalizedStopType === "Metro" ? "M" : "O");

    const stopIconFontSize =
      stopIcon.length >= 4 ? 7 :
      stopIcon.length === 3 ? 8 :
      stopIcon.length === 2 ? 9 : 10;

    const fallbackColor =
      normalizedStopType === "Metro" ? "#7c3aed" : "#2563eb";

    const stylesList = [
      new Style({
        image: new CircleStyle({
          radius: 10,
          fill: new Fill({
            color: routeColor || fallbackColor,
          }),
        }),
        text: new Text({
          text: stopIcon,
          font: `bold ${stopIconFontSize}px Arial`,
          textAlign: "center",
          textBaseline: "middle",
          offsetY: 0,
          fill: new Fill({
            color: "#ffffff",
          }),
        }),
        zIndex: 120,
      }),
    ];

    if (showName && stopName) {
      stylesList.push(
        new Style({
          text: new Text({
            text: stopName,
            font: "600 11px Arial",
            offsetY: -19,
            textAlign: "center",
            fill: new Fill({
              color: "#0f172a",
            }),
            stroke: new Stroke({
              color: "rgba(255,255,255,0.96)",
              width: 3,
            }),
          }),
          zIndex: 121,
        })
      );
    }

    return stylesList;
  };

  const createTransitRouteLineStyle = (feature) => {
    const routeColor = feature.get("routeColor") || "#2563eb";
    const stopType =
      String(feature.get("stopType") || "Bus").toLowerCase() === "metro"
        ? "Metro"
        : "Bus";

    // Hocanın istediği görünüm: yalnızca güzergah çizgisi.
    // Önceden rota boyunca oluşturulan yön okları tamamen kaldırıldı.
    return [
      new Style({
        stroke: new Stroke({
          color: "rgba(255,255,255,0.92)",
          width: stopType === "Metro" ? 6 : 5.5,
          lineCap: "round",
          lineJoin: "round",
        }),
        zIndex: 106,
      }),
      new Style({
        stroke: new Stroke({
          color: routeColor,
          width: stopType === "Metro" ? 3.6 : 3.4,
          lineCap: "round",
          lineJoin: "round",
        }),
        zIndex: 107,
      }),
    ];
  };

  const drawGeneratedTransitRoutes = (routeItems = []) => {
    const lineSource = transitRouteLineSourceRef.current;
    if (!lineSource) return;

    lineSource.clear();
    const wktFormat = new WKT();

    routeItems.forEach((route) => {
      const routeId = Number(route.id ?? route.Id);

      if (
        Number.isInteger(routeId) &&
        hiddenTransitRouteIdsRef.current.has(routeId)
      ) {
        return;
      }

      const routeWkt = route.routeWkt ?? route.RouteWkt;
      if (!routeWkt || typeof routeWkt !== "string") return;

      const routeStops = Array.isArray(route.stops ?? route.Stops)
        ? route.stops ?? route.Stops
        : [];

      const firstStop = routeStops.find(
        (stop) =>
          String(stop.stopType ?? stop.StopType ?? "").trim() !== ""
      );

      const normalizedStopType =
        String(firstStop?.stopType ?? firstStop?.StopType ?? "Bus")
          .toLowerCase() === "metro"
          ? "Metro"
          : "Bus";

      if (
        visibleTransitStopTypesRef.current[normalizedStopType] === false
      ) {
        return;
      }

      try {
        const routeFeature = wktFormat.readFeature(routeWkt, {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857",
        });

        if (routeFeature.getGeometry()?.getType() !== "LineString") {
          return;
        }

        routeFeature.set("featureType", "TransitRouteLine");
        routeFeature.set("transitRouteId", route.id ?? route.Id);
        routeFeature.set("routeName", route.name ?? route.Name ?? "");
        routeFeature.set(
          "routeShortCode",
          route.shortCode ?? route.ShortCode ?? ""
        );
        routeFeature.set(
          "routeColor",
          route.color ?? route.Color ?? "#2563eb"
        );
        routeFeature.set("stopType", normalizedStopType);
        routeFeature.set(
          "distanceMeters",
          route.distanceMeters ?? route.DistanceMeters ?? null
        );
        routeFeature.set(
          "durationSeconds",
          route.durationSeconds ?? route.DurationSeconds ?? null
        );
        routeFeature.set(
          "routeUpdatedDate",
          route.routeUpdatedDate ?? route.RouteUpdatedDate ?? null
        );
        routeFeature.set("routeWkt", routeWkt);

        lineSource.addFeature(routeFeature);
      } catch (error) {
        console.error(
          `OSRM RouteWkt okunamadı. Güzergah ID: ${
            route.id ?? route.Id ?? "-"
          }`,
          error
        );
      }
    });

    lineSource.changed();
    mapObjectRef.current?.render();
  };

 const createVehicleStyle = (feature) => {
  const vehicleType =
    String(feature.get("vehicleType") || "Bus").toLowerCase() === "metro"
      ? "Metro"
      : "Bus";

  const routeColor =
    feature.get("routeColor") ||
    (vehicleType === "Metro" ? "#10b981" : "#2563eb");

  const shortCode = String(feature.get("shortCode") || "")
    .trim()
    .toUpperCase()
    .slice(0, 6);

  /*
    Dışarıdaki SVG dosyasını çağırmıyoruz.
    İkon doğrudan kod içinde üretildiği için beyaz/boş görünmez.
  */
  const busIconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
      <defs>
        <linearGradient id="busBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3b82f6"/>
          <stop offset="100%" stop-color="#1d4ed8"/>
        </linearGradient>
        <linearGradient id="busWindow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#334155"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>

      <rect x="32" y="16" width="86" height="112" rx="25" fill="url(#busBody)"/>
      <rect x="46" y="30" width="58" height="45" rx="12" fill="url(#busWindow)"/>
      <rect x="48" y="83" width="54" height="22" rx="3" fill="#dbeafe"/>
      <rect x="40" y="112" width="25" height="14" rx="7" fill="#ffffff"/>
      <rect x="85" y="112" width="25" height="14" rx="7" fill="#ffffff"/>
      <rect x="23" y="46" width="11" height="35" rx="5" fill="#1e40af"/>
      <rect x="116" y="46" width="11" height="35" rx="5" fill="#1e40af"/>
      <rect x="54" y="4" width="42" height="14" rx="7" fill="#172554"/>
      <rect x="49" y="127" width="16" height="18" rx="6" fill="#172554"/>
      <rect x="85" y="127" width="16" height="18" rx="6" fill="#172554"/>
    </svg>
  `;

  const metroIconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
      <defs>
        <linearGradient id="metroBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#dbeafe"/>
        </linearGradient>
        <linearGradient id="metroWindow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#334155"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>

      <path
        d="M75 8
           C37 8 24 30 24 75
           C24 119 42 136 75 136
           C108 136 126 119 126 75
           C126 30 113 8 75 8Z"
        fill="${routeColor}"
      />

      <path
        d="M75 18
           C45 18 36 37 36 75
           C36 108 49 124 75 124
           C101 124 114 108 114 75
           C114 37 105 18 75 18Z"
        fill="url(#metroBody)"
      />

      <path
        d="M47 39
           Q75 21 103 39
           L108 76
           L42 76Z"
        fill="url(#metroWindow)"
      />

      <path
        d="M45 88 L105 88 L95 111 L55 111Z"
        fill="${routeColor}"
      />

      <circle cx="55" cy="113" r="9" fill="#ffffff"/>
      <circle cx="95" cy="113" r="9" fill="#ffffff"/>

      <path d="M56 136 L68 123 L72 136Z" fill="#172554"/>
      <path d="M94 136 L82 123 L78 136Z" fill="#172554"/>
    </svg>
  `;

  const selectedSvg =
    vehicleType === "Metro"
      ? metroIconSvg
      : busIconSvg;

  const iconSource =
    `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      selectedSvg
    )}`;

  const vehicleStyles = [
    // Hafif dış parlama
    new Style({
      image: new CircleStyle({
        radius: 18,
        fill: new Fill({
          color: hexToRgba(routeColor, 0.18),
        }),
      }),
      zIndex: 498,
    }),

    // Beyaz arka plan ve rota rengi çerçeve
    new Style({
      image: new CircleStyle({
        radius: 15,
        fill: new Fill({
          color: "#ffffff",
        }),
        stroke: new Stroke({
          color: routeColor,
          width: 2.5,
        }),
      }),
      zIndex: 499,
    }),

    // Kod içinde oluşturulan gerçek araç ikonu
    new Style({
      image: new Icon({
        src: iconSource,
        width: vehicleType === "Metro" ? 25 : 24,
        height: vehicleType === "Metro" ? 25 : 24,
        anchor: [0.5, 0.5],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
      }),
      zIndex: 500,
    }),
  ];

  if (shortCode) {
    vehicleStyles.push(
      new Style({
        text: new Text({
          text: shortCode,
          font: "700 10px Arial",
          offsetY: -25,
          padding: [2, 5, 2, 5],

          fill: new Fill({
            color: "#ffffff",
          }),

          backgroundFill: new Fill({
            color: routeColor,
          }),

          backgroundStroke: new Stroke({
            color: "#ffffff",
            width: 1.5,
          }),
        }),
        zIndex: 501,
      })
    );
  }

  return vehicleStyles;
};

  const getRouteFractionForCoordinate = (routeGeometry, coordinate) => {
    if (
      !routeGeometry ||
      routeGeometry.getType() !== "LineString" ||
      !Array.isArray(coordinate)
    ) {
      return 0;
    }

    const coordinates = routeGeometry.getCoordinates();
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return 0;
    }

    let totalLength = 0;
    const segmentLengths = [];

    for (let index = 0; index < coordinates.length - 1; index += 1) {
      const start = coordinates[index];
      const end = coordinates[index + 1];
      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      segmentLengths.push(segmentLength);
      totalLength += segmentLength;
    }

    if (!Number.isFinite(totalLength) || totalLength <= 0) {
      return 0;
    }

    let nearestDistanceSquared = Number.POSITIVE_INFINITY;
    let nearestDistanceAlongRoute = 0;
    let traversedLength = 0;

    for (let index = 0; index < coordinates.length - 1; index += 1) {
      const start = coordinates[index];
      const end = coordinates[index + 1];
      const segmentLength = segmentLengths[index];

      if (!Number.isFinite(segmentLength) || segmentLength <= 0) {
        continue;
      }

      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      const lengthSquared = dx * dx + dy * dy;
      const rawRatio =
        ((coordinate[0] - start[0]) * dx +
          (coordinate[1] - start[1]) * dy) /
        lengthSquared;
      const ratio = Math.max(0, Math.min(1, rawRatio));
      const projectedCoordinate = [
        start[0] + dx * ratio,
        start[1] + dy * ratio,
      ];
      const distanceX = coordinate[0] - projectedCoordinate[0];
      const distanceY = coordinate[1] - projectedCoordinate[1];
      const distanceSquared =
        distanceX * distanceX + distanceY * distanceY;

      if (distanceSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared;
        nearestDistanceAlongRoute =
          traversedLength + segmentLength * ratio;
      }

      traversedLength += segmentLength;
    }

    return Math.max(
      0,
      Math.min(1, nearestDistanceAlongRoute / totalLength)
    );
  };

  const getVehicleRouteStops = (routeId) => {
    const normalizedRouteId = Number(routeId);
    if (!Number.isInteger(normalizedRouteId) || normalizedRouteId <= 0) {
      return [];
    }

    const routeFeature = transitRouteLineSourceRef.current
      ?.getFeatures()
      .find(
        (feature) =>
          Number(feature.get("transitRouteId")) === normalizedRouteId
      );

    const routeGeometry = routeFeature?.getGeometry();

    const orderedStops = (
      transitStopSourceRef.current?.getFeatures() || []
    )
      .filter(
        (feature) =>
          feature.get("featureType") === "TransitStop" &&
          Number(feature.get("transitRouteId")) === normalizedRouteId
      )
      .sort((firstStop, secondStop) => {
        const firstOrder = Number(firstStop.get("orderNo") ?? 0);
        const secondOrder = Number(secondStop.get("orderNo") ?? 0);

        if (firstOrder !== secondOrder) {
          return firstOrder - secondOrder;
        }

        return (
          Number(firstStop.get("id") ?? 0) -
          Number(secondStop.get("id") ?? 0)
        );
      });

    let previousFraction = 0;

    return orderedStops.map((feature, index) => {
      const coordinate = feature.getGeometry()?.getCoordinates();
      let fraction =
        routeGeometry?.getType() === "LineString" && coordinate
          ? getRouteFractionForCoordinate(routeGeometry, coordinate)
          : orderedStops.length <= 1
            ? 0
            : index / (orderedStops.length - 1);

      // Döngüsel veya birbirine çok yakın rota parçalarında durak sırası
      // görselde geriye gitmesin.
      fraction = Math.max(previousFraction, fraction);
      previousFraction = fraction;

      return {
        id: feature.get("id") ?? index,
        name: feature.get("name") || `Durak ${index + 1}`,
        orderNo: Number(feature.get("orderNo") ?? index + 1),
        fraction,
        positionPercent: fraction * 100,
      };
    });
  };

  const getVehicleStopSegment = (vehicle) => {
    const stops = Array.isArray(vehicle?.routeStops)
      ? vehicle.routeStops
      : [];

    const progress = Math.max(
      0,
      Math.min(100, Number(vehicle?.progress || 0))
    );

    if (stops.length === 0) {
      return {
        previousStop: null,
        nextStop: null,
        segmentProgress: 0,
      };
    }

    if (stops.length === 1) {
      return {
        previousStop: stops[0],
        nextStop: null,
        segmentProgress: progress,
      };
    }

    let previousStop = stops[0];
    let nextStop = stops[stops.length - 1];

    for (let index = 0; index < stops.length - 1; index += 1) {
      const currentStop = stops[index];
      const followingStop = stops[index + 1];
      const currentPosition = Number(currentStop.positionPercent || 0);
      const followingPosition = Number(
        followingStop.positionPercent || 100
      );

      if (
        progress >= currentPosition &&
        progress <= followingPosition
      ) {
        previousStop = currentStop;
        nextStop = followingStop;
        break;
      }
    }

    const previousPosition = Number(
      previousStop?.positionPercent || 0
    );
    const nextPosition = Number(
      nextStop?.positionPercent || 100
    );
    const segmentLength = Math.max(0.0001, nextPosition - previousPosition);
    const segmentProgress = Math.max(
      0,
      Math.min(
        100,
        ((progress - previousPosition) / segmentLength) * 100
      )
    );

    return {
      previousStop,
      nextStop,
      segmentProgress,
    };
  };

  const calculateDistanceBetweenRouteFractions = (
    routeId,
    startFraction,
    endFraction
  ) => {
    const normalizedRouteId = Number(routeId);

    if (
      !Number.isInteger(normalizedRouteId) ||
      normalizedRouteId <= 0
    ) {
      return null;
    }

    const routeFeature = transitRouteLineSourceRef.current
      ?.getFeatures()
      .find(
        (feature) =>
          Number(feature.get("transitRouteId")) ===
          normalizedRouteId
      );

    const routeGeometry = routeFeature?.getGeometry();

    if (
      !routeGeometry ||
      routeGeometry.getType() !== "LineString"
    ) {
      return null;
    }

    const coordinates = routeGeometry.getCoordinates();

    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return null;
    }

    const safeStartFraction = Math.max(
      0,
      Math.min(1, Number(startFraction) || 0)
    );
    const safeEndFraction = Math.max(
      safeStartFraction,
      Math.min(1, Number(endFraction) || 0)
    );

    if (safeEndFraction <= safeStartFraction) {
      return 0;
    }

    const segmentLengths = [];
    let totalProjectedLength = 0;

    for (let index = 0; index < coordinates.length - 1; index += 1) {
      const start = coordinates[index];
      const end = coordinates[index + 1];
      const deltaX = end[0] - start[0];
      const deltaY = end[1] - start[1];
      const segmentLength = Math.sqrt(
        deltaX * deltaX + deltaY * deltaY
      );

      segmentLengths.push(segmentLength);
      totalProjectedLength += segmentLength;
    }

    if (
      !Number.isFinite(totalProjectedLength) ||
      totalProjectedLength <= 0
    ) {
      return null;
    }

    const startDistance =
      totalProjectedLength * safeStartFraction;
    const endDistance =
      totalProjectedLength * safeEndFraction;
    const selectedCoordinates = [
      routeGeometry.getCoordinateAt(safeStartFraction),
    ];

    let traversedLength = 0;

    for (let index = 0; index < coordinates.length - 1; index += 1) {
      traversedLength += segmentLengths[index];

      if (
        traversedLength > startDistance &&
        traversedLength < endDistance
      ) {
        selectedCoordinates.push(coordinates[index + 1]);
      }
    }

    selectedCoordinates.push(
      routeGeometry.getCoordinateAt(safeEndFraction)
    );

    let totalDistanceMeters = 0;

    for (
      let index = 0;
      index < selectedCoordinates.length - 1;
      index += 1
    ) {
      const firstCoordinate = selectedCoordinates[index];
      const secondCoordinate = selectedCoordinates[index + 1];

      if (!firstCoordinate || !secondCoordinate) {
        continue;
      }

      totalDistanceMeters += getDistance(
        toLonLat(firstCoordinate),
        toLonLat(secondCoordinate)
      );
    }

    return Number.isFinite(totalDistanceMeters)
      ? totalDistanceMeters
      : null;
  };



  /*
   * TEMATİK HARİTA
   *
   * Hocanın istediği durak, hat ve POI verilerini
   * renkli/analitik katmanlara dönüştüren istemci tarafı görselleştirmeleri.
   */
  const removeThematicLayer = (themeKey) => {
    const map = mapObjectRef.current;
    const layer =
      thematicLayerRefs.current?.[themeKey];

    if (map && layer) {
      map.removeLayer(layer);
      layer.getSource?.()?.clear?.();
    }

    thematicLayerRefs.current[themeKey] =
      null;
  };

  const clearAllThematicLayers = () => {
    Object.keys(
      thematicLayerRefs.current
    ).forEach((themeKey) => {
      removeThematicLayer(themeKey);
    });

    setThematicThemes({
      stopHeatmap: false,
      poiHeatmap: false,
      walkingAccess: false,
      poiAccessibility: false,
      routeCoverage: false,
    });

    mapObjectRef.current?.render();
  };

  const createThematicPointCopy = (
    originalFeature,
    featureType
  ) => {
    const geometry =
      originalFeature?.getGeometry();

    if (
      !geometry ||
      geometry.getType() !== "Point"
    ) {
      return null;
    }

    const feature = new Feature({
      geometry: geometry.clone(),
    });

    feature.set(
      "featureType",
      featureType
    );

    return feature;
  };

  const createStopHeatmapLayer = () => {
    const source = new VectorSource();

    (
      transitStopSourceRef.current
        ?.getFeatures() || []
    ).forEach((stopFeature) => {
      if (
        stopFeature.get("featureType") !==
        "TransitStop"
      ) {
        return;
      }

      const copy =
        createThematicPointCopy(
          stopFeature,
          "ThematicStopHeat"
        );

      if (!copy) return;

      /*
       * Her durak aynı temel ağırlıkla başlar.
       * Aynı bölgede çok durak olduğunda OpenLayers
       * otomatik olarak daha sıcak yoğunluk üretir.
       */
      copy.set("weight", 1);
      source.addFeature(copy);
    });

    return new HeatmapLayer({
      source,
      blur: 24,
      radius: 18,
      weight: (feature) =>
        Number(
          feature.get("weight") || 1
        ),
      gradient: [
        "#2563eb",
        "#06b6d4",
        "#22c55e",
        "#facc15",
        "#f97316",
        "#dc2626",
      ],
      opacity: 0.86,
      zIndex: 212,
    });
  };

  const createPoiHeatmapLayer = () => {
    const source = new VectorSource();

    (
      poiSourceRef.current?.getFeatures() ||
      []
    ).forEach((poiFeature) => {
      if (
        poiFeature.get("featureType") !==
        "Poi"
      ) {
        return;
      }

      const copy =
        createThematicPointCopy(
          poiFeature,
          "ThematicPoiHeat"
        );

      if (!copy) return;

      copy.set("weight", 1);
      source.addFeature(copy);
    });

    return new HeatmapLayer({
      source,
      blur: 26,
      radius: 19,
      weight: (feature) =>
        Number(
          feature.get("weight") || 1
        ),
      gradient: [
        "#312e81",
        "#7c3aed",
        "#db2777",
        "#f97316",
        "#fde047",
      ],
      opacity: 0.82,
      zIndex: 213,
    });
  };

  const createWalkingAccessLayer = () => {
    const source = new VectorSource();

    const distances = [
      {
        meters: 1000,
        color:
          "rgba(239,68,68,0.065)",
        stroke:
          "rgba(239,68,68,0.30)",
      },
      {
        meters: 600,
        color:
          "rgba(245,158,11,0.075)",
        stroke:
          "rgba(245,158,11,0.34)",
      },
      {
        meters: 300,
        color:
          "rgba(22,163,74,0.10)",
        stroke:
          "rgba(22,163,74,0.42)",
      },
    ];

    (
      transitStopSourceRef.current
        ?.getFeatures() || []
    ).forEach((stopFeature) => {
      if (
        stopFeature.get("featureType") !==
        "TransitStop"
      ) {
        return;
      }

      const coordinate =
        stopFeature
          .getGeometry()
          ?.getCoordinates();

      if (!coordinate) return;

      distances.forEach(
        (distanceDefinition) => {
          const feature = new Feature({
            geometry:
              new CircleGeometry(
                coordinate,
                distanceDefinition.meters
              ),
          });

          feature.set(
            "featureType",
            "ThematicWalkingAccess"
          );

          feature.set(
            "accessMeters",
            distanceDefinition.meters
          );

          feature.setStyle(
            new Style({
              fill: new Fill({
                color:
                  distanceDefinition.color,
              }),
              stroke: new Stroke({
                color:
                  distanceDefinition.stroke,
                width: 1.2,
              }),
              zIndex:
                214 -
                distanceDefinition.meters /
                  1000,
            })
          );

          source.addFeature(feature);
        }
      );
    });

    return new VectorLayer({
      source,
      zIndex: 211,
    });
  };

  const getNearestTransitStopDistance =
    (poiFeature) => {
      const poiCoordinate =
        poiFeature
          ?.getGeometry()
          ?.getCoordinates();

      if (!poiCoordinate) {
        return null;
      }

      const poiLonLat =
        toLonLat(poiCoordinate);

      let nearestDistance =
        Number.POSITIVE_INFINITY;

      (
        transitStopSourceRef.current
          ?.getFeatures() || []
      ).forEach((stopFeature) => {
        if (
          stopFeature.get(
            "featureType"
          ) !== "TransitStop"
        ) {
          return;
        }

        const stopCoordinate =
          stopFeature
            .getGeometry()
            ?.getCoordinates();

        if (!stopCoordinate) return;

        const distance = getDistance(
          poiLonLat,
          toLonLat(stopCoordinate)
        );

        if (
          Number.isFinite(distance) &&
          distance < nearestDistance
        ) {
          nearestDistance = distance;
        }
      });

      return Number.isFinite(
        nearestDistance
      )
        ? nearestDistance
        : null;
    };

  const createPoiAccessibilityLayer =
    () => {
      const source = new VectorSource();

      (
        poiSourceRef.current
          ?.getFeatures() || []
      ).forEach((poiFeature) => {
        if (
          poiFeature.get(
            "featureType"
          ) !== "Poi"
        ) {
          return;
        }

        const distanceMeters =
          getNearestTransitStopDistance(
            poiFeature
          );

        if (
          !Number.isFinite(
            distanceMeters
          )
        ) {
          return;
        }

        const copy =
          createThematicPointCopy(
            poiFeature,
            "ThematicPoiAccessibility"
          );

        if (!copy) return;

        copy.set(
          "nearestStopDistanceMeters",
          distanceMeters
        );

        let color = "#ef4444";

        if (distanceMeters <= 500) {
          color = "#22c55e";
        } else if (
          distanceMeters <= 1000
        ) {
          color = "#f59e0b";
        }

        copy.setStyle(
          new Style({
            image: new CircleStyle({
              radius: 9,
              fill: new Fill({
                color:
                  hexToRgba(
                    color,
                    0.88
                  ),
              }),
              stroke: new Stroke({
                color: "#ffffff",
                width: 2,
              }),
            }),
            text: new Text({
              text:
                distanceMeters >= 1000
                  ? `${(
                      distanceMeters /
                      1000
                    ).toFixed(1)}k`
                  : `${Math.round(
                      distanceMeters
                    )}m`,
              font:
                "700 8px Arial",
              offsetY: -17,
              fill: new Fill({
                color: "#0f172a",
              }),
              stroke: new Stroke({
                color:
                  "rgba(255,255,255,0.96)",
                width: 3,
              }),
            }),
            zIndex: 219,
          })
        );

        source.addFeature(copy);
      });

      return new VectorLayer({
        source,
        zIndex: 218,
      });
    };

  const createRouteCoverageLayer = () => {
    const source = new VectorSource();

    const stopCountsByRoute =
      new globalThis.Map();

    (
      transitStopSourceRef.current
        ?.getFeatures() || []
    ).forEach((stopFeature) => {
      const routeId = Number(
        stopFeature.get(
          "transitRouteId"
        )
      );

      if (
        !Number.isInteger(routeId)
      ) {
        return;
      }

      stopCountsByRoute.set(
        routeId,
        (stopCountsByRoute.get(routeId) ||
          0) + 1
      );
    });

    (
      transitRouteLineSourceRef.current
        ?.getFeatures() || []
    ).forEach((routeFeature) => {
      if (
        routeFeature.get(
          "featureType"
        ) !== "TransitRouteLine"
      ) {
        return;
      }

      const geometry =
        routeFeature.getGeometry();

      if (
        !geometry ||
        geometry.getType() !==
          "LineString"
      ) {
        return;
      }

      const routeId = Number(
        routeFeature.get(
          "transitRouteId"
        )
      );

      const stopCount =
        stopCountsByRoute.get(routeId) ||
        0;

      const copy = new Feature({
        geometry: geometry.clone(),
      });

      copy.set(
        "featureType",
        "ThematicRouteCoverage"
      );

      copy.set(
        "stopCount",
        stopCount
      );

      /*
       * Daha fazla durağı olan hat daha kalın ve daha sıcak görünür.
       */
      const width = Math.max(
        4,
        Math.min(
          12,
          3 + stopCount * 0.9
        )
      );

      const color =
        stopCount >= 8
          ? "#dc2626"
          : stopCount >= 5
            ? "#f97316"
            : stopCount >= 3
              ? "#facc15"
              : "#22c55e";

      copy.setStyle([
        new Style({
          stroke: new Stroke({
            color:
              "rgba(255,255,255,0.92)",
            width: width + 3,
            lineCap: "round",
            lineJoin: "round",
          }),
          zIndex: 215,
        }),
        new Style({
          stroke: new Stroke({
            color,
            width,
            lineCap: "round",
            lineJoin: "round",
          }),
          zIndex: 216,
        }),
      ]);

      source.addFeature(copy);
    });

    return new VectorLayer({
      source,
      zIndex: 216,
    });
  };

  const toggleThematicTheme = (
    themeKey,
    shouldEnable
  ) => {
    const map = mapObjectRef.current;

    if (!map) {
      return;
    }

    removeThematicLayer(themeKey);

    if (!shouldEnable) {
      setThematicThemes(
        (current) => ({
          ...current,
          [themeKey]: false,
        })
      );

      map.render();
      return;
    }

    let layer = null;

    if (themeKey === "stopHeatmap") {
      layer =
        createStopHeatmapLayer();
    } else if (
      themeKey === "poiHeatmap"
    ) {
      layer =
        createPoiHeatmapLayer();
    } else if (
      themeKey === "walkingAccess"
    ) {
      layer =
        createWalkingAccessLayer();
    } else if (
      themeKey ===
      "poiAccessibility"
    ) {
      layer =
        createPoiAccessibilityLayer();
    } else if (
      themeKey === "routeCoverage"
    ) {
      layer =
        createRouteCoverageLayer();
    }

    if (!layer) {
      return;
    }

    thematicLayerRefs.current[
      themeKey
    ] = layer;

    map.addLayer(layer);

    setThematicThemes(
      (current) => ({
        ...current,
        [themeKey]: true,
      })
    );

    map.render();
  };

  /*
   * Hocanın istediği Toplu Taşıma Yol Tarifi görselleştirmesi:
   *
   * A -> Yürü -> Bin -> İn -> Yürü -> B
   *
   * Bu source yalnızca yol tarifi sonucuna ait geçici çizimleri tutar.
   * Mevcut güzergah, durak ve araç katmanlarına dokunmaz.
   */
  const addTransitJourneyPointFeature = (
    source,
    point,
    featureType,
    label,
    color
  ) => {
    if (!source || !point) return;

    const longitude = Number(point.longitude);
    const latitude = Number(point.latitude);

    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude)
    ) {
      return;
    }

    const feature = new Feature({
      geometry: new Point(
        fromLonLat([longitude, latitude])
      ),
    });

    feature.set("featureType", featureType);
    feature.set("journeyLabel", label);

    const isTransferMarker =
      label === "BİN" ||
      label === "İN";

    const isStartOrEndMarker =
      label === "A" ||
      label === "B";

    feature.setStyle(
      new Style({
        image: new CircleStyle({
          radius: isTransferMarker
            ? 10
            : 8,
          fill: new Fill({
            color,
          }),
          stroke: new Stroke({
            color: "rgba(255,255,255,0.98)",
            width: isTransferMarker
              ? 2
              : 2.2,
          }),
        }),
        text: isStartOrEndMarker
          ? undefined
          : new Text({
              text: label,
              font:
                "900 8px Inter, Arial, sans-serif",
              fill: new Fill({
                color: "#ffffff",
              }),
              stroke: new Stroke({
                color: "rgba(0,0,0,0.18)",
                width: 1,
              }),
              textAlign: "center",
              textBaseline: "middle",
            }),
        zIndex: 710,
      })
    );

    source.addFeature(feature);
  };

  const drawTransitJourneyBasePoints = (
    startPoint = transitJourneyStartPointRef.current,
    endPoint = transitJourneyEndPointRef.current
  ) => {
    const source = transitJourneySourceRef.current;

    if (!source) return;

    source.clear();

    addTransitJourneyPointFeature(
      source,
      startPoint,
      "TransitJourneyStart",
      "A",
      "#16a34a"
    );

    addTransitJourneyPointFeature(
      source,
      endPoint,
      "TransitJourneyEnd",
      "B",
      "#dc2626"
    );

    source.changed();
    mapObjectRef.current?.render();
  };

  const getTransitJourneyLineSegment = (
    routeGeometry,
    startCoordinate,
    endCoordinate
  ) => {
    if (
      !routeGeometry ||
      routeGeometry.getType() !== "LineString" ||
      !Array.isArray(startCoordinate) ||
      !Array.isArray(endCoordinate)
    ) {
      return null;
    }

    const startFraction =
      getRouteFractionForCoordinate(
        routeGeometry,
        startCoordinate
      );

    const endFraction =
      getRouteFractionForCoordinate(
        routeGeometry,
        endCoordinate
      );

    const safeStartFraction = Math.max(
      0,
      Math.min(1, startFraction)
    );

    const safeEndFraction = Math.max(
      safeStartFraction,
      Math.min(1, endFraction)
    );

    if (safeEndFraction <= safeStartFraction) {
      return new LineString([
        startCoordinate,
        endCoordinate,
      ]);
    }

    const routeCoordinates =
      routeGeometry.getCoordinates();

    if (
      !Array.isArray(routeCoordinates) ||
      routeCoordinates.length < 2
    ) {
      return null;
    }

    const segmentLengths = [];
    let totalLength = 0;

    for (
      let index = 0;
      index < routeCoordinates.length - 1;
      index += 1
    ) {
      const start = routeCoordinates[index];
      const end = routeCoordinates[index + 1];

      const dx = end[0] - start[0];
      const dy = end[1] - start[1];

      const segmentLength = Math.sqrt(
        dx * dx + dy * dy
      );

      segmentLengths.push(segmentLength);
      totalLength += segmentLength;
    }

    if (
      !Number.isFinite(totalLength) ||
      totalLength <= 0
    ) {
      return null;
    }

    const startDistance =
      totalLength * safeStartFraction;

    const endDistance =
      totalLength * safeEndFraction;

    const selectedCoordinates = [
      routeGeometry.getCoordinateAt(
        safeStartFraction
      ),
    ];

    let travelledLength = 0;

    for (
      let index = 0;
      index < routeCoordinates.length - 1;
      index += 1
    ) {
      travelledLength += segmentLengths[index];

      if (
        travelledLength > startDistance &&
        travelledLength < endDistance
      ) {
        selectedCoordinates.push(
          routeCoordinates[index + 1]
        );
      }
    }

    selectedCoordinates.push(
      routeGeometry.getCoordinateAt(
        safeEndFraction
      )
    );

    if (selectedCoordinates.length < 2) {
      return null;
    }

    return new LineString(
      selectedCoordinates
    );
  };

  const drawTransitJourneyAlternative = (
    alternative
  ) => {
    const source = transitJourneySourceRef.current;

    if (!source) return;

    source.clear();

    addTransitJourneyPointFeature(
      source,
      transitJourneyStartPointRef.current,
      "TransitJourneyStart",
      "A",
      "#16a34a"
    );

    addTransitJourneyPointFeature(
      source,
      transitJourneyEndPointRef.current,
      "TransitJourneyEnd",
      "B",
      "#dc2626"
    );

    if (!alternative) {
      source.changed();
      mapObjectRef.current?.render();
      return;
    }

    const routeColor =
      alternative.routeColor ||
      "#2563eb";

    const steps = Array.isArray(
      alternative.steps
    )
      ? alternative.steps
      : [];

    /*
     * Başlangıç / bitiş yürüyüşleri.
     *
     * Backend, Walking OSRM (localhost:5002) tarafından üretilen
     * GERÇEK yaya rota geometrisini step.geometryWkt içinde gönderir.
     *
     * Önceden yalnızca from/to koordinatları LineString ile
     * birleştirildiği için çizgi kuş uçuşu görünüyordu.
     *
     * Artık öncelik GeometryWkt'dedir.
     */
    steps
      .filter(
        (step) =>
          String(
            step.type ??
              step.Type ??
              ""
          ).toLowerCase() === "walk"
      )
      .forEach((step) => {
        const geometryWkt =
          step.geometryWkt ??
          step.GeometryWkt ??
          "";

        /*
         * GERÇEK WALKING OSRM GEOMETRİSİ
         */
        if (
          typeof geometryWkt === "string" &&
          geometryWkt.trim()
        ) {
          try {
            const wktFormat = new WKT();

            const walkingFeature =
              wktFormat.readFeature(
                geometryWkt,
                {
                  dataProjection:
                    "EPSG:4326",
                  featureProjection:
                    "EPSG:3857",
                }
              );

            const walkingGeometry =
              walkingFeature.getGeometry();

            if (
              walkingGeometry &&
              (
                walkingGeometry.getType() ===
                  "LineString" ||
                walkingGeometry.getType() ===
                  "MultiLineString"
              )
            ) {
              walkingFeature.set(
                "featureType",
                "TransitJourneyWalk"
              );

              walkingFeature.set(
                "walkingGeometrySource",
                "OSRM"
              );

              walkingFeature.setStyle(
                new Style({
                  stroke: new Stroke({
                    color:
                      "rgba(37, 99, 235, 0.98)",
                    width: 4,
                    lineDash: [1, 10],
                    lineCap: "round",
                    lineJoin: "round",
                  }),
                  zIndex: 700,
                })
              );

              source.addFeature(
                walkingFeature
              );

              return;
            }

            console.warn(
              "Walking GeometryWkt LineString değil:",
              geometryWkt
            );
          } catch (error) {
            console.error(
              "Walking GeometryWkt okunamadı:",
              geometryWkt,
              error
            );
          }
        }

        /*
         * FALLBACK
         *
         * Normal durumda buraya girilmemeli.
         * GeometryWkt herhangi bir nedenle gelmezse
         * A/B noktalarının tamamen kaybolmaması için
         * düz çizgi yalnızca yedek olarak kullanılır.
         *
         * Kırmızı kesik çizgi görünürse backend cevabında
         * GeometryWkt olmadığını hemen anlayabiliriz.
         */
        const fromLongitude = Number(
          step.fromLongitude ??
            step.FromLongitude
        );

        const fromLatitude = Number(
          step.fromLatitude ??
            step.FromLatitude
        );

        const toLongitude = Number(
          step.toLongitude ??
            step.ToLongitude
        );

        const toLatitude = Number(
          step.toLatitude ??
            step.ToLatitude
        );

        if (
          !Number.isFinite(fromLongitude) ||
          !Number.isFinite(fromLatitude) ||
          !Number.isFinite(toLongitude) ||
          !Number.isFinite(toLatitude)
        ) {
          console.warn(
            "Walking step için geçerli geometri veya koordinat bulunamadı:",
            step
          );
          return;
        }

        const fallbackFeature =
          new Feature({
            geometry: new LineString([
              fromLonLat([
                fromLongitude,
                fromLatitude,
              ]),
              fromLonLat([
                toLongitude,
                toLatitude,
              ]),
            ]),
          });

        fallbackFeature.set(
          "featureType",
          "TransitJourneyWalkFallback"
        );

        fallbackFeature.set(
          "walkingGeometrySource",
          "Fallback"
        );

        fallbackFeature.setStyle(
          new Style({
            stroke: new Stroke({
              color:
                "rgba(37, 99, 235, 0.90)",
              width: 4,
              lineDash: [1, 10],
              lineCap: "round",
              lineJoin: "round",
            }),
            zIndex: 699,
          })
        );

        source.addFeature(
          fallbackFeature
        );
      });

    /*
     * Toplu taşıma segmentini gerçek RouteWkt geometrisinden
     * biniş ve iniş durağı arasında keserek gösteriyoruz.
     */
    const transitStep = steps.find(
      (step) =>
        String(step.type || "")
          .toLowerCase() === "transit"
    );

    if (
      transitStep &&
      alternative.routeWkt
    ) {
      try {
        const wktFormat = new WKT();

        const routeFeature =
          wktFormat.readFeature(
            alternative.routeWkt,
            {
              dataProjection:
                "EPSG:4326",
              featureProjection:
                "EPSG:3857",
            }
          );

        const routeGeometry =
          routeFeature.getGeometry();

        const boardingCoordinate =
          fromLonLat([
            Number(
              transitStep.fromLongitude
            ),
            Number(
              transitStep.fromLatitude
            ),
          ]);

        const alightingCoordinate =
          fromLonLat([
            Number(
              transitStep.toLongitude
            ),
            Number(
              transitStep.toLatitude
            ),
          ]);

        const segmentGeometry =
          getTransitJourneyLineSegment(
            routeGeometry,
            boardingCoordinate,
            alightingCoordinate
          );

        if (segmentGeometry) {
          const transitFeature =
            new Feature({
              geometry:
                segmentGeometry,
            });

          transitFeature.set(
            "featureType",
            "TransitJourneyTransit"
          );

          transitFeature.setStyle([
            new Style({
              stroke: new Stroke({
                color:
                  "rgba(255,255,255,0.98)",
                width: 9,
                lineCap: "round",
                lineJoin: "round",
              }),
              zIndex: 703,
            }),
            new Style({
              stroke: new Stroke({
                color: routeColor,
                width: 6,
                lineCap: "round",
                lineJoin: "round",
              }),
              zIndex: 704,
            }),
          ]);

          source.addFeature(
            transitFeature
          );
        }
      } catch (error) {
        console.error(
          "Toplu taşıma yol tarifi RouteWkt çizilemedi:",
          error
        );
      }
    }

    if (transitStep) {
      const boardingPoint = {
        longitude: Number(
          transitStep.fromLongitude
        ),
        latitude: Number(
          transitStep.fromLatitude
        ),
      };

      const alightingPoint = {
        longitude: Number(
          transitStep.toLongitude
        ),
        latitude: Number(
          transitStep.toLatitude
        ),
      };

      addTransitJourneyPointFeature(
        source,
        boardingPoint,
        "TransitJourneyBoarding",
        "BİN",
        routeColor
      );

      addTransitJourneyPointFeature(
        source,
        alightingPoint,
        "TransitJourneyAlighting",
        "İN",
        "#f59e0b"
      );
    }

    source.changed();

    const map = mapObjectRef.current;
    const extent =
      source.getExtent();

    if (
      map &&
      extent &&
      extent.every(
        (value) => Number.isFinite(value)
      )
    ) {
      map.getView().fit(extent, {
        padding: [
          110,
          90,
          90,
          470,
        ],
        duration: 650,
        maxZoom: 12,
      });
    }

    map?.render();
  };

  const clearTransitJourney = () => {
    transitJourneySourceRef.current?.clear();

    transitJourneyStartPointRef.current = null;
    transitJourneyEndPointRef.current = null;

    setTransitJourneyStartPoint(null);
    setTransitJourneyEndPoint(null);

    setTransitJourneySelectionMode("");
    transitJourneySelectionModeRef.current = "";
  };

  const startTransitJourneyPointSelection = (
    mode
  ) => {
    const normalizedMode =
      mode === "end"
        ? "end"
        : "start";

    setTransitJourneySelectionMode(
      normalizedMode
    );

    transitJourneySelectionModeRef.current =
      normalizedMode;

    /*
     * Haritaya nokta seçerken normal popup açma davranışı
     * yerine sadece A/B noktası seçilir.
     */
    setPopupOpen(false);
    setPoiInfoOpen(false);
    setTransitStopInfoOpen(false);
    setVehicleInfoOpen(false);
  };

  const handleTransitJourneyMapPointSelection = (
    coordinate,
    mode
  ) => {
    if (
      !Array.isArray(coordinate) ||
      coordinate.length < 2
    ) {
      return;
    }

    const lonLat =
      toLonLat(coordinate);

    const selectedPoint = {
      longitude: Number(lonLat[0]),
      latitude: Number(lonLat[1]),
    };

    if (
      !Number.isFinite(
        selectedPoint.longitude
      ) ||
      !Number.isFinite(
        selectedPoint.latitude
      )
    ) {
      return;
    }

    if (mode === "end") {
      transitJourneyEndPointRef.current =
        selectedPoint;

      setTransitJourneyEndPoint(
        selectedPoint
      );

      drawTransitJourneyBasePoints(
        transitJourneyStartPointRef.current,
        selectedPoint
      );
    } else {
      transitJourneyStartPointRef.current =
        selectedPoint;

      setTransitJourneyStartPoint(
        selectedPoint
      );

      drawTransitJourneyBasePoints(
        selectedPoint,
        transitJourneyEndPointRef.current
      );
    }

    setTransitJourneySelectionMode("");
    transitJourneySelectionModeRef.current = "";
  };

  const selectTransitJourneyPoi = (
    mode,
    poi
  ) => {
    const longitude =
      Number(poi?.longitude);

    const latitude =
      Number(poi?.latitude);

    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude)
    ) {
      return;
    }

    const selectedPoint = {
      longitude,
      latitude,
      poiId:
        poi?.id ?? null,
      poiName:
        poi?.name ?? "",
    };

    if (mode === "end") {
      transitJourneyEndPointRef.current =
        selectedPoint;

      setTransitJourneyEndPoint(
        selectedPoint
      );

      drawTransitJourneyBasePoints(
        transitJourneyStartPointRef.current,
        selectedPoint
      );
    } else {
      transitJourneyStartPointRef.current =
        selectedPoint;

      setTransitJourneyStartPoint(
        selectedPoint
      );

      drawTransitJourneyBasePoints(
        selectedPoint,
        transitJourneyEndPointRef.current
      );
    }

    setTransitJourneySelectionMode("");
    transitJourneySelectionModeRef.current = "";
  };


  const getDistanceToNextStop = (vehicle, stopSegment) => {
    const nextStop = stopSegment?.nextStop;

    if (!vehicle || !nextStop) {
      return null;
    }

    const currentFraction = Math.max(
      0,
      Math.min(1, Number(vehicle.progress || 0) / 100)
    );
    const nextStopFraction = Math.max(
      currentFraction,
      Math.min(
        1,
        Number(
          nextStop.fraction ??
            Number(nextStop.positionPercent || 0) / 100
        )
      )
    );

    return calculateDistanceBetweenRouteFractions(
      vehicle.routeId,
      currentFraction,
      nextStopFraction
    );
  };

  const formatTransitDistance = (distanceMeters) => {
    const numericDistance = Number(distanceMeters);

    if (!Number.isFinite(numericDistance)) {
      return null;
    }

    if (numericDistance < 1000) {
      return `${Math.max(0, Math.round(numericDistance))} m`;
    }

    return `${(numericDistance / 1000)
      .toFixed(1)
      .replace(".", ",")} km`;
  };

  const formatVehicleEta = (seconds) => {
    const numericSeconds = Number(seconds);

    if (!Number.isFinite(numericSeconds) || numericSeconds < 0) {
      return null;
    }

    const roundedSeconds = Math.max(0, Math.round(numericSeconds));

    if (roundedSeconds < 60) {
      return `${roundedSeconds} sn`;
    }

    const minutes = Math.floor(roundedSeconds / 60);
    const remainingSeconds = roundedSeconds % 60;

    if (minutes < 60) {
      return remainingSeconds > 0
        ? `${minutes} dk ${remainingSeconds} sn`
        : `${minutes} dk`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes > 0
      ? `${hours} sa ${remainingMinutes} dk`
      : `${hours} sa`;
  };

  const getVehicleStatusLabel = (status, isRunning = true) => {
    const normalizedStatus = String(status || "").trim();

    const labels = {
      WaitingAtStart: "Başlangıçta bekliyor",
      Accelerating: "Hızlanıyor",
      Cruising: "Seyir halinde",
      ApproachingStop: "Durağa yaklaşıyor",
      ArrivedAtStop: "Durağa ulaştı",
      WaitingAtStop: "Durakta bekliyor",
      DepartingStop: "Duraktan ayrılıyor",
      Completed: "Tamamlandı",
      Stopped: "Durduruldu",
    };

    return labels[normalizedStatus] ||
      (isRunning ? "Çalışıyor" : "Durduruldu");
  };

  const normalizeVehicleSimulationData = (simulationData) => {
    if (!simulationData) return null;

    const routeId = Number(
      simulationData.routeId ??
        simulationData.RouteId ??
        simulationData.transitRouteId ??
        simulationData.TransitRouteId
    );

    if (!Number.isInteger(routeId) || routeId <= 0) {
      return null;
    }

    const simulationId = String(
      simulationData.simulationId ??
        simulationData.SimulationId ??
        ""
    ).trim();

    /*
      Yeni çoklu araç mimarisinde ana kimlik SimulationId'dir.
      Eski payload ile kısa süreli geriye uyumluluk için SimulationId yoksa
      route tabanlı geçici bir anahtar üretilebilir; yeni backend normalde
      her zaman gerçek Guid gönderecektir.
    */
    const vehicleKey =
      simulationId || `legacy-route-${routeId}`;

    const tripIdRaw =
      simulationData.tripId ??
      simulationData.TripId;

    const tripId = Number(tripIdRaw);

    const progress = Number(
      simulationData.progress ??
        simulationData.Progress ??
        simulationData.progressPercent ??
        simulationData.ProgressPercent ??
        0
    );

    let longitude = Number(
      simulationData.longitude ??
        simulationData.Longitude ??
        simulationData.currentLongitude ??
        simulationData.CurrentLongitude ??
        simulationData.lng ??
        simulationData.Lng
    );

    let latitude = Number(
      simulationData.latitude ??
        simulationData.Latitude ??
        simulationData.currentLatitude ??
        simulationData.CurrentLatitude ??
        simulationData.lat ??
        simulationData.Lat
    );

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      const routeFeature = transitRouteLineSourceRef.current
        ?.getFeatures()
        .find(
          (feature) =>
            Number(feature.get("transitRouteId")) === routeId
        );

      const routeGeometry = routeFeature?.getGeometry();

      if (routeGeometry?.getType() === "LineString") {
        const fraction = Math.max(
          0,
          Math.min(1, progress / 100)
        );

        const routeCoordinate =
          routeGeometry.getCoordinateAt(fraction);

        if (routeCoordinate) {
          const calculatedLonLat =
            toLonLat(routeCoordinate);

          longitude = Number(calculatedLonLat?.[0]);
          latitude = Number(calculatedLonLat?.[1]);
        }
      }
    }

    return {
      simulationId,
      vehicleKey,

      tripId:
        Number.isInteger(tripId) && tripId > 0
          ? tripId
          : null,

      tripCode:
        simulationData.tripCode ??
        simulationData.TripCode ??
        "",

      vehicleCode:
        simulationData.vehicleCode ??
        simulationData.VehicleCode ??
        "",

      serviceDate:
        simulationData.serviceDate ??
        simulationData.ServiceDate ??
        null,

      departureTime:
        simulationData.departureTime ??
        simulationData.DepartureTime ??
        null,

      isAutomatic:
        simulationData.isAutomatic ??
        simulationData.IsAutomatic ??
        false,

      routeId,

      routeName:
        simulationData.routeName ??
        simulationData.RouteName ??
        "",

      shortCode:
        simulationData.shortCode ??
        simulationData.ShortCode ??
        "",

      routeColor:
        simulationData.routeColor ??
        simulationData.RouteColor ??
        "#2563eb",

      vehicleType:
        simulationData.vehicleType ??
        simulationData.VehicleType ??
        "Bus",

      progress:
        Number.isFinite(progress)
          ? progress
          : 0,

      isRunning:
        simulationData.isRunning ??
        simulationData.IsRunning ??
        true,

      longitude,
      latitude,

      currentSpeedKmh: Number(
        simulationData.currentSpeedKmh ??
          simulationData.CurrentSpeedKmh ??
          0
      ),

      maxSpeedKmh: Number(
        simulationData.maxSpeedKmh ??
          simulationData.MaxSpeedKmh ??
          0
      ),

      travelledDistanceMeters: Number(
        simulationData.travelledDistanceMeters ??
          simulationData.TravelledDistanceMeters ??
          0
      ),

      routeLengthMeters: Number(
        simulationData.routeLengthMeters ??
          simulationData.RouteLengthMeters ??
          0
      ),

      previousStopId:
        simulationData.previousStopId ??
        simulationData.PreviousStopId ??
        null,

      previousStopName:
        simulationData.previousStopName ??
        simulationData.PreviousStopName ??
        "",

      nextStopId:
        simulationData.nextStopId ??
        simulationData.NextStopId ??
        null,

      nextStopName:
        simulationData.nextStopName ??
        simulationData.NextStopName ??
        "",

      distanceToNextStopMeters: Number(
        simulationData.distanceToNextStopMeters ??
          simulationData.DistanceToNextStopMeters
      ),

      estimatedArrivalSeconds: Number(
        simulationData.estimatedArrivalSeconds ??
          simulationData.EstimatedArrivalSeconds
      ),

      isWaitingAtStop:
        simulationData.isWaitingAtStop ??
        simulationData.IsWaitingAtStop ??
        false,

      waitingStopId:
        simulationData.waitingStopId ??
        simulationData.WaitingStopId ??
        null,

      waitingStopName:
        simulationData.waitingStopName ??
        simulationData.WaitingStopName ??
        "",

      currentStopWaitSeconds: Number(
        simulationData.currentStopWaitSeconds ??
          simulationData.CurrentStopWaitSeconds ??
          0
      ),

      stopDwellDurationSeconds: Number(
        simulationData.stopDwellDurationSeconds ??
          simulationData.StopDwellDurationSeconds ??
          0
      ),

      remainingStopWaitSeconds: Number(
        simulationData.remainingStopWaitSeconds ??
          simulationData.RemainingStopWaitSeconds ??
          0
      ),

      status:
        simulationData.status ??
        simulationData.Status ??
        "",

      lastUpdated:
        simulationData.lastUpdated ??
        simulationData.LastUpdated ??
        simulationData.lastUpdatedDate ??
        simulationData.LastUpdatedDate ??
        simulationData.updatedAt ??
        simulationData.UpdatedAt ??
        new Date().toISOString(),
    };
  };

  const animateVehicleAlongRoute = (
    vehicleFeature,
    simulationId,
    routeId,
    targetProgress,
    fallbackTargetCoordinate
  ) => {
    if (!vehicleFeature) return;

    const simulationKey = String(simulationId || "").trim();

    if (!simulationKey) {
      return;
    }

    const geometry = vehicleFeature.getGeometry();

    if (!geometry) {
      return;
    }

    const existingFrameId =
      vehicleAnimationFramesRef.current.get(
        simulationKey
      );

    if (existingFrameId) {
      cancelAnimationFrame(existingFrameId);

      vehicleAnimationFramesRef.current.delete(
        simulationKey
      );
    }

    const safeTargetProgress = Math.max(
      0,
      Math.min(100, Number(targetProgress) || 0)
    );

    const currentDisplayedProgress = Number(
      vehicleFeature.get("displayProgress")
    );

    const startProgress =
      Number.isFinite(currentDisplayedProgress)
        ? currentDisplayedProgress
        : safeTargetProgress;

    const routeFeature =
      transitRouteLineSourceRef.current
        ?.getFeatures()
        .find(
          (feature) =>
            Number(
              feature.get("transitRouteId")
            ) === routeId
        );

    const routeGeometry =
      routeFeature?.getGeometry();

    const canFollowRoute =
      routeGeometry?.getType() === "LineString";

    const startCoordinate =
      geometry.getCoordinates();

    const targetCoordinate =
      canFollowRoute
        ? routeGeometry.getCoordinateAt(
            safeTargetProgress / 100
          )
        : fallbackTargetCoordinate;

    if (!targetCoordinate) {
      return;
    }

    const progressDifference =
      safeTargetProgress - startProgress;

    if (progressDifference < -0.05) {
      geometry.setCoordinates(targetCoordinate);

      vehicleFeature.set(
        "displayProgress",
        safeTargetProgress
      );

      vehicleLastUpdateTimesRef.current.set(
        simulationKey,
        performance.now()
      );

      if (
        followingVehicleSimulationIdRef.current ===
        simulationKey
      ) {
        mapObjectRef.current
          ?.getView()
          ?.setCenter(targetCoordinate);
      }

      vehicleSourceRef.current?.changed();
      mapObjectRef.current?.render();

      return;
    }

    if (
      !Number.isFinite(startProgress) ||
      Math.abs(progressDifference) < 0.00001
    ) {
      geometry.setCoordinates(targetCoordinate);

      vehicleFeature.set(
        "displayProgress",
        safeTargetProgress
      );

      if (
        followingVehicleSimulationIdRef.current ===
        simulationKey
      ) {
        mapObjectRef.current
          ?.getView()
          ?.setCenter(targetCoordinate);
      }

      vehicleSourceRef.current?.changed();
      mapObjectRef.current?.render();

      return;
    }

    const now = performance.now();

    const previousUpdateTime =
      vehicleLastUpdateTimesRef.current.get(
        simulationKey
      );

    const measuredInterval =
      Number.isFinite(previousUpdateTime)
        ? now - previousUpdateTime
        : 100;

    vehicleLastUpdateTimesRef.current.set(
      simulationKey,
      now
    );

    const animationDuration = Math.max(
      70,
      Math.min(300, measuredInterval * 0.95)
    );

    const animationStartTime =
      performance.now();

    const easeInOut = (value) =>
      value < 0.5
        ? 2 * value * value
        : 1 - Math.pow(-2 * value + 2, 2) / 2;

    const runFrame = (frameTime) => {
      const linearRatio = Math.min(
        1,
        (frameTime - animationStartTime) /
          animationDuration
      );

      const ratio = easeInOut(linearRatio);

      const displayedProgress =
        startProgress +
        progressDifference * ratio;

      let currentCoordinate = null;

      if (canFollowRoute) {
        currentCoordinate =
          routeGeometry.getCoordinateAt(
            Math.max(
              0,
              Math.min(
                1,
                displayedProgress / 100
              )
            )
          );
      } else if (
        Array.isArray(startCoordinate) &&
        Array.isArray(targetCoordinate)
      ) {
        currentCoordinate = [
          startCoordinate[0] +
            (targetCoordinate[0] -
              startCoordinate[0]) *
              ratio,

          startCoordinate[1] +
            (targetCoordinate[1] -
              startCoordinate[1]) *
              ratio,
        ];
      }

      if (currentCoordinate) {
        geometry.setCoordinates(
          currentCoordinate
        );

        vehicleFeature.set(
          "displayProgress",
          displayedProgress
        );

        if (
          followingVehicleSimulationIdRef.current ===
          simulationKey
        ) {
          mapObjectRef.current
            ?.getView()
            ?.setCenter(currentCoordinate);
        }

        vehicleSourceRef.current?.changed();
        mapObjectRef.current?.render();
      }

      if (linearRatio < 1) {
        const nextFrameId =
          requestAnimationFrame(runFrame);

        vehicleAnimationFramesRef.current.set(
          simulationKey,
          nextFrameId
        );

        return;
      }

      geometry.setCoordinates(
        targetCoordinate
      );

      vehicleFeature.set(
        "displayProgress",
        safeTargetProgress
      );

      vehicleAnimationFramesRef.current.delete(
        simulationKey
      );

      vehicleSourceRef.current?.changed();
      mapObjectRef.current?.render();
    };

    const frameId =
      requestAnimationFrame(runFrame);

    vehicleAnimationFramesRef.current.set(
      simulationKey,
      frameId
    );
  };

  const upsertVehicleFeature = (simulationData) => {
    const source = vehicleSourceRef.current;

    if (!source || !simulationData) {
      return;
    }

    const normalizedSimulation =
      normalizeVehicleSimulationData(
        simulationData
      );

    if (!normalizedSimulation) {
      return;
    }

    const {
      simulationId,
      vehicleKey,
      routeId,
      longitude,
      latitude,
    } = normalizedSimulation;

    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude)
    ) {
      console.warn(
        `Araç konumu üretilemedi. SimulationId: ${vehicleKey}, RouteId: ${routeId}`,
        simulationData
      );

      return;
    }

    let vehicleFeature = source
      .getFeatures()
      .find(
        (feature) =>
          String(
            feature.get("simulationId") || ""
          ) === vehicleKey
      );

    const targetCoordinate = fromLonLat([
      longitude,
      latitude,
    ]);

    if (!vehicleFeature) {
      vehicleFeature = new Feature({
        geometry: new Point(
          targetCoordinate
        ),
      });

      vehicleFeature.set(
        "featureType",
        "TransitVehicle"
      );

      vehicleFeature.set(
        "simulationId",
        vehicleKey
      );

      vehicleFeature.set(
        "transitRouteId",
        routeId
      );

      vehicleFeature.set(
        "displayProgress",
        normalizedSimulation.progress
      );

      vehicleLastUpdateTimesRef.current.set(
        vehicleKey,
        performance.now()
      );

      source.addFeature(vehicleFeature);
    } else {
      animateVehicleAlongRoute(
        vehicleFeature,
        vehicleKey,
        routeId,
        normalizedSimulation.progress,
        targetCoordinate
      );
    }

    vehicleFeature.set(
      "backendSimulationId",
      simulationId
    );

    vehicleFeature.set(
      "tripId",
      normalizedSimulation.tripId
    );

    vehicleFeature.set(
      "tripCode",
      normalizedSimulation.tripCode
    );

    vehicleFeature.set(
      "vehicleCode",
      normalizedSimulation.vehicleCode
    );

    vehicleFeature.set(
      "serviceDate",
      normalizedSimulation.serviceDate
    );

    vehicleFeature.set(
      "departureTime",
      normalizedSimulation.departureTime
    );

    vehicleFeature.set(
      "isAutomatic",
      normalizedSimulation.isAutomatic
    );

    vehicleFeature.set(
      "transitRouteId",
      routeId
    );

    vehicleFeature.set(
      "routeName",
      normalizedSimulation.routeName
    );

    vehicleFeature.set(
      "shortCode",
      normalizedSimulation.shortCode
    );

    vehicleFeature.set(
      "routeColor",
      normalizedSimulation.routeColor
    );

    vehicleFeature.set(
      "vehicleType",
      normalizedSimulation.vehicleType
    );

    vehicleFeature.set(
      "progress",
      normalizedSimulation.progress
    );

    vehicleFeature.set(
      "isRunning",
      normalizedSimulation.isRunning
    );

    vehicleFeature.set(
      "currentSpeedKmh",
      normalizedSimulation.currentSpeedKmh
    );

    vehicleFeature.set(
      "maxSpeedKmh",
      normalizedSimulation.maxSpeedKmh
    );

    vehicleFeature.set(
      "travelledDistanceMeters",
      normalizedSimulation.travelledDistanceMeters
    );

    vehicleFeature.set(
      "routeLengthMeters",
      normalizedSimulation.routeLengthMeters
    );

    vehicleFeature.set(
      "previousStopId",
      normalizedSimulation.previousStopId
    );

    vehicleFeature.set(
      "previousStopName",
      normalizedSimulation.previousStopName
    );

    vehicleFeature.set(
      "nextStopId",
      normalizedSimulation.nextStopId
    );

    vehicleFeature.set(
      "nextStopName",
      normalizedSimulation.nextStopName
    );

    vehicleFeature.set(
      "distanceToNextStopMeters",
      normalizedSimulation.distanceToNextStopMeters
    );

    vehicleFeature.set(
      "estimatedArrivalSeconds",
      normalizedSimulation.estimatedArrivalSeconds
    );

    vehicleFeature.set(
      "isWaitingAtStop",
      normalizedSimulation.isWaitingAtStop
    );

    vehicleFeature.set(
      "waitingStopId",
      normalizedSimulation.waitingStopId
    );

    vehicleFeature.set(
      "waitingStopName",
      normalizedSimulation.waitingStopName
    );

    vehicleFeature.set(
      "currentStopWaitSeconds",
      normalizedSimulation.currentStopWaitSeconds
    );

    vehicleFeature.set(
      "stopDwellDurationSeconds",
      normalizedSimulation.stopDwellDurationSeconds
    );

    vehicleFeature.set(
      "remainingStopWaitSeconds",
      normalizedSimulation.remainingStopWaitSeconds
    );

    vehicleFeature.set(
      "status",
      normalizedSimulation.status
    );

    vehicleFeature.set(
      "longitude",
      longitude
    );

    vehicleFeature.set(
      "latitude",
      latitude
    );

    vehicleFeature.set(
      "lastUpdated",
      normalizedSimulation.lastUpdated
    );

    const liveVehicleData = {
      simulationId: vehicleKey,
      backendSimulationId: simulationId,

      tripId:
        vehicleFeature.get("tripId") ??
        null,

      tripCode:
        vehicleFeature.get("tripCode") ||
        "",

      vehicleCode:
        vehicleFeature.get("vehicleCode") ||
        "",

      serviceDate:
        vehicleFeature.get("serviceDate") ??
        null,

      departureTime:
        vehicleFeature.get("departureTime") ??
        null,

      isAutomatic:
        vehicleFeature.get("isAutomatic") === true,

      routeId,

      routeName:
        vehicleFeature.get("routeName") ||
        "",

      shortCode:
        vehicleFeature.get("shortCode") ||
        "",

      routeColor:
        vehicleFeature.get("routeColor") ||
        "#2563eb",

      vehicleType:
        vehicleFeature.get("vehicleType") ||
        "Bus",

      progress: Number(
        vehicleFeature.get("progress") ||
          0
      ),

      isRunning:
        vehicleFeature.get("isRunning") !==
        false,

      currentSpeedKmh: Number(
        vehicleFeature.get("currentSpeedKmh") ||
          0
      ),

      maxSpeedKmh: Number(
        vehicleFeature.get("maxSpeedKmh") ||
          0
      ),

      travelledDistanceMeters: Number(
        vehicleFeature.get(
          "travelledDistanceMeters"
        ) || 0
      ),

      routeLengthMeters: Number(
        vehicleFeature.get(
          "routeLengthMeters"
        ) || 0
      ),

      previousStopId:
        vehicleFeature.get("previousStopId") ??
        null,

      previousStopName:
        vehicleFeature.get("previousStopName") ||
        "",

      nextStopId:
        vehicleFeature.get("nextStopId") ??
        null,

      nextStopName:
        vehicleFeature.get("nextStopName") ||
        "",

      distanceToNextStopMeters: Number(
        vehicleFeature.get(
          "distanceToNextStopMeters"
        )
      ),

      estimatedArrivalSeconds: Number(
        vehicleFeature.get(
          "estimatedArrivalSeconds"
        )
      ),

      isWaitingAtStop:
        vehicleFeature.get(
          "isWaitingAtStop"
        ) === true,

      waitingStopId:
        vehicleFeature.get("waitingStopId") ??
        null,

      waitingStopName:
        vehicleFeature.get("waitingStopName") ||
        "",

      currentStopWaitSeconds: Number(
        vehicleFeature.get(
          "currentStopWaitSeconds"
        ) || 0
      ),

      stopDwellDurationSeconds: Number(
        vehicleFeature.get(
          "stopDwellDurationSeconds"
        ) || 0
      ),

      remainingStopWaitSeconds: Number(
        vehicleFeature.get(
          "remainingStopWaitSeconds"
        ) || 0
      ),

      status:
        vehicleFeature.get("status") ||
        "",

      longitude,
      latitude,

      lastUpdated:
        vehicleFeature.get("lastUpdated"),

      routeStops:
        getVehicleRouteStops(routeId),
    };

    if (
      selectedVehicleSimulationIdRef.current ===
      vehicleKey
    ) {
      setSelectedVehicle(
        liveVehicleData
      );
    }

    source.changed();
    mapObjectRef.current?.render();
  };

  const removeVehicleFeature = (
    simulationDataOrId
  ) => {
    const source =
      vehicleSourceRef.current;

    if (!source) {
      return;
    }

    const rawSimulationId =
      typeof simulationDataOrId === "object"
        ? simulationDataOrId?.simulationId ??
          simulationDataOrId?.SimulationId ??
          ""
        : simulationDataOrId;

    const simulationId =
      String(rawSimulationId || "").trim();

    if (!simulationId) {
      return;
    }

    const runningFrameId =
      vehicleAnimationFramesRef.current.get(
        simulationId
      );

    if (runningFrameId) {
      cancelAnimationFrame(
        runningFrameId
      );

      vehicleAnimationFramesRef.current.delete(
        simulationId
      );
    }

    vehicleLastUpdateTimesRef.current.delete(
      simulationId
    );

    const vehicleFeature = source
      .getFeatures()
      .find(
        (feature) =>
          String(
            feature.get("simulationId") || ""
          ) === simulationId
      );

    if (vehicleFeature) {
      source.removeFeature(
        vehicleFeature
      );

      source.changed();
      mapObjectRef.current?.render();
    }

    if (
      selectedVehicleSimulationIdRef.current ===
      simulationId
    ) {
      selectedVehicleSimulationIdRef.current =
        null;

      setSelectedVehicle(null);
      setVehicleInfoOpen(false);
    }

    if (
      followingVehicleSimulationIdRef.current ===
      simulationId
    ) {
      followingVehicleSimulationIdRef.current =
        null;

      setFollowingVehicleSimulationId(
        null
      );
    }
  };

  const createEditStyle = () => {
    return new Style({
      stroke: new Stroke({
        color: "#f59e0b",
        width: 5,
      }),
      fill: new Fill({
        color: "rgba(245,158,11,0.20)",
      }),
      image: new CircleStyle({
        radius: 10,
        fill: new Fill({
          color: "#f59e0b",
        }),
      }),
    });
  };

  const calculateInventoryInPolygon = (polygonFeature) => {
    const vectorSource = sourceRef.current;
    if (!vectorSource) return null;

    const analysisGeometry = polygonFeature.getGeometry();

    let pointCount = 0;
    let lineCount = 0;
    let polygonCount = 0;

    vectorSource.getFeatures().forEach((feature) => {
      if (feature === polygonFeature) return;

      const featureType = feature.get("featureType");
      const geometry = feature.getGeometry();

      if (!geometry || !featureType) return;

      if (featureType === "Point") {
        const coordinate = geometry.getCoordinates();

        if (analysisGeometry.intersectsCoordinate(coordinate)) {
          pointCount++;
        }
      }

      if (featureType === "LineString") {
        if (analysisGeometry.intersectsExtent(geometry.getExtent())) {
          lineCount++;
        }
      }

      if (featureType === "Polygon") {
        if (analysisGeometry.intersectsExtent(geometry.getExtent())) {
          polygonCount++;
        }
      }
    });

    return {
      pointCount,
      lineCount,
      polygonCount,
      total: pointCount + lineCount + polygonCount,
    };
  };
const getCurrentUserId = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));

    return (
      payload[
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
      ] ||
      payload.nameid ||
      payload.sub ||
      null
    );
  } catch {
    return null;
  }
};

const refreshGlobalDrawingAccess = async () => {
  const tokenRoleNames = getDrawingRoleNamesFromToken();

  if (hasUnlimitedMapDrawingRole(tokenRoleNames)) {
    hasGlobalDrawingAccessRef.current = true;
    return true;
  }

  const currentUserId = Number(getCurrentUserId());

  if (!Number.isInteger(currentUserId) || currentUserId <= 0) {
    hasGlobalDrawingAccessRef.current = false;
    return false;
  }

  try {
    /*
      Bazı JWT'lerde rol claim'i bulunmadığı için UserRoles ve Roles
      tablolarını API üzerinden eşleştiriyoruz. Alan isimlerinin farklı
      casing ile gelme ihtimalleri de destekleniyor.
    */
    const [userRolesResponse, rolesResponse] = await Promise.all([
      axios.get(`${API_BASE_URL}/api/UserRoles`, getAuthConfig()),
      axios.get(`${API_BASE_URL}/api/Roles`, getAuthConfig()),
    ]);

    const userRoleItems = Array.isArray(userRolesResponse.data)
      ? userRolesResponse.data
      : Array.isArray(userRolesResponse.data?.items)
        ? userRolesResponse.data.items
        : [];

    const roleItems = Array.isArray(rolesResponse.data)
      ? rolesResponse.data
      : Array.isArray(rolesResponse.data?.items)
        ? rolesResponse.data.items
        : [];

    const roleNameById = new globalThis.Map();

    roleItems.forEach((roleItem) => {
      const roleId = Number(
        roleItem?.id ??
          roleItem?.Id ??
          roleItem?.roleId ??
          roleItem?.RoleId
      );

      const roleName =
        roleItem?.name ??
        roleItem?.Name ??
        roleItem?.roleName ??
        roleItem?.RoleName ??
        "";

      if (Number.isInteger(roleId) && roleId > 0 && roleName) {
        roleNameById.set(roleId, roleName);
      }
    });

    const currentUserRoleNames = userRoleItems
      .filter((userRoleItem) => {
        const assignedUserId = Number(
          userRoleItem?.userId ??
            userRoleItem?.UserId ??
            userRoleItem?.user?.id ??
            userRoleItem?.User?.Id
        );

        return assignedUserId === currentUserId;
      })
      .flatMap((userRoleItem) => {
        const directRoleName =
          userRoleItem?.roleName ??
          userRoleItem?.RoleName ??
          userRoleItem?.role?.name ??
          userRoleItem?.Role?.Name ??
          "";

        const roleId = Number(
          userRoleItem?.roleId ??
            userRoleItem?.RoleId ??
            userRoleItem?.role?.id ??
            userRoleItem?.Role?.Id
        );

        const mappedRoleName = roleNameById.get(roleId) || "";

        return [directRoleName, mappedRoleName].filter(Boolean);
      });

    const hasGlobalAccess = hasUnlimitedMapDrawingRole(
      currentUserRoleNames
    );

    hasGlobalDrawingAccessRef.current = hasGlobalAccess;
    return hasGlobalAccess;
  } catch (error) {
    console.warn(
      "Admin/Operatör global çizim yetkisi API üzerinden doğrulanamadı:",
      error
    );

    hasGlobalDrawingAccessRef.current = false;
    return false;
  }
};
const createWmsLayer = (layerName, currentUserId) => {
  const cqlFilter = `IsDeleted=false AND IsActive=true AND UserId=${currentUserId}`;

  return new TileLayer({
    source: new TileWMS({
      url: GEOSERVER_WMS_URL,
      params: {
        LAYERS: `staj:${layerName}`,
        TILED: true,
        FORMAT: "image/png",
        TRANSPARENT: true,
        CQL_FILTER: cqlFilter,
      },
      serverType: "geoserver",
      crossOrigin: "anonymous",
    }),
    opacity: 0.9,
  });
};
  const setNormalGeometryVisibility = (showNormalGeometries) => {
    if (!sourceRef.current) return;

    sourceRef.current.getFeatures().forEach((feature) => {
      const featureType = feature.get("featureType");

      if (
        featureType !== "Point" &&
        featureType !== "LineString" &&
        featureType !== "Polygon"
      ) {
        return;
      }

      const shouldShow =
        showNormalGeometries && visibleLayers[featureType] !== false;

      feature.setStyle(
        shouldShow
          ? createFeatureStyle(
              featureType,
              feature.get("color") || "#2563eb"
            )
          : new Style({})
      );
    });
  };

  const removeHeatmapLayers = () => {
    const map = mapObjectRef.current;
    if (!map) return;

    heatmapLayerRef.current.forEach((layer) => {
      map.removeLayer(layer);
    });

    heatmapLayerRef.current = [];
  };

 // GeoServer olmadan (canlı sürüm) ısı haritası tarayıcıda,
 // kullanıcının kendi nokta / hat / alan geometrilerinden üretilir.
 const createClientHeatmapLayer = () => {
  const heatSource = new VectorSource();

  const addPoint = (coordinate) => {
    heatSource.addFeature(
      new Feature({ geometry: new Point(coordinate), weight: 1 })
    );
  };

  const addAlongLine = (coordinates) => {
    for (let i = 0; i < coordinates.length; i += 1) {
      addPoint(coordinates[i]);

      if (i === 0) continue;

      const [x1, y1] = coordinates[i - 1];
      const [x2, y2] = coordinates[i];
      const length = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.min(50, Math.floor(length / 300));

      for (let step = 1; step < steps; step += 1) {
        const t = step / steps;
        addPoint([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
      }
    }
  };

  (sourceRef.current?.getFeatures() || []).forEach((feature) => {
    const featureType = feature.get("featureType");
    const geometry = feature.getGeometry();

    if (!geometry) return;

    if (featureType === "Point") {
      addPoint(geometry.getCoordinates());
    } else if (featureType === "LineString") {
      addAlongLine(geometry.getCoordinates());
    } else if (featureType === "Polygon") {
      const rings = geometry.getCoordinates();
      addAlongLine(rings[0] || []);

      if (typeof geometry.getInteriorPoint === "function") {
        addPoint(geometry.getInteriorPoint().getCoordinates().slice(0, 2));
      }
    }
  });

  const layer = new HeatmapLayer({
    source: heatSource,
    blur: 22,
    radius: 14,
    weight: (feature) => Number(feature.get("weight") || 1),
    opacity: 0.92,
    zIndex: 200,
  });

  layer.set("layerType", "Heatmap-Client");
  return layer;
 };

 const toggleHeatmap = () => {
  const map = mapObjectRef.current;

  if (!map) {
    console.error("Harita nesnesi bulunamadı.");
    return;
  }

  if (heatmapOpen) {
    removeHeatmapLayers();
    setNormalGeometryVisibility(true);
    setHeatmapOpen(false);
    return;
  }

  const currentUserId = Number(getCurrentUserId());

  if (
    !Number.isInteger(currentUserId) ||
    currentUserId <= 0
  ) {
    alert("Kullanıcı bilgisi alınamadı.");
    return;
  }

  removeHeatmapLayers();

  if (!GEOSERVER_ENABLED) {
    const clientLayer = createClientHeatmapLayer();
    map.addLayer(clientLayer);
    heatmapLayerRef.current = [clientLayer];
    setNormalGeometryVisibility(false);
    setHeatmapOpen(true);
    map.renderSync();
    return;
  }

  const heatmapDefinitions = [
    {
      layerName: "Points",
      cqlFilter:
        `IsActive=true AND IsDeleted=false AND UserId=${currentUserId}`,
    },
    {
      layerName: "LineHeatPoints",
      cqlFilter:
        `IsActive=true AND IsDeleted=false AND UserId=${currentUserId}`,
    },
    {
      layerName: "PolygonHeatPoints",
      cqlFilter:
        `IsActive=true AND IsDeleted=false AND UserId=${currentUserId}`,
    },
  ];

  const requestStamp = Date.now();

  const createdHeatmapLayers = heatmapDefinitions.map(
    (definition, index) => {
      const heatmapSource = new TileWMS({
        url: GEOSERVER_WMS_URL,

        params: {
          LAYERS: `staj:${definition.layerName}`,
          STYLES: "staj:points_heatmap",
          FORMAT: "image/png",
          TRANSPARENT: true,
          TILED: false,
          CQL_FILTER: definition.cqlFilter,
          _t: `${requestStamp}-${index}`,
        },

        serverType: "geoserver",
        crossOrigin: "anonymous",
        transition: 0,
      });

      heatmapSource.on("tileloaderror", (event) => {
        console.error(
          `Isı haritası yüklenemedi: ${definition.layerName}`,
          event
        );
      });

      const heatmapLayer = new TileLayer({
        source: heatmapSource,
        opacity: 0.92,
        visible: true,
        zIndex: 200 + index,
      });

      heatmapLayer.set(
        "layerType",
        `Heatmap-${definition.layerName}`
      );

      map.addLayer(heatmapLayer);

      return heatmapLayer;
    }
  );

  heatmapLayerRef.current = createdHeatmapLayers;

  setNormalGeometryVisibility(false);
  setHeatmapOpen(true);

  map.renderSync();
};
  // MapPage.jsx içinde SADECE mevcut loadSavedGeometries fonksiyonunu
// aşağıdaki fonksiyonla değiştir.

const loadSavedGeometries = async (vectorSource) => {
  const wktFormat = new WKT();
  const hiddenItems = getHiddenItems();

  try {
    vectorSource.clear();

    // getApiUrl fonksiyonu "/api/points" gibi URL değil,
    // "Point", "LineString" ve "Polygon" tiplerini bekliyor.
    const [pointsResponse, linesResponse, polygonsResponse] =
      await Promise.all([
        axios.get(getApiUrl("Point"), getAuthConfig()),
        axios.get(getApiUrl("LineString"), getAuthConfig()),
        axios.get(getApiUrl("Polygon"), getAuthConfig()),
      ]);

    const geometryGroups = [
      {
        type: "Point",
        items: Array.isArray(pointsResponse.data)
          ? pointsResponse.data
          : [],
      },
      {
        type: "LineString",
        items: Array.isArray(linesResponse.data)
          ? linesResponse.data
          : [],
      },
      {
        type: "Polygon",
        items: Array.isArray(polygonsResponse.data)
          ? polygonsResponse.data
          : [],
      },
    ];

    geometryGroups.forEach(({ type, items }) => {
      items.forEach((item) => {
        const dataId = item.id ?? item.Id;
        const dataWkt = item.wkt ?? item.Wkt;
        const dataName = item.name ?? item.Name ?? "";
        const dataColor = item.color ?? item.Color ?? "#2563eb";
        const dataDescription =
          item.description ?? item.Description ?? "";
        const dataCreatedDate =
          item.createdDate ?? item.CreatedDate ?? "";

        if (!dataWkt) return;

        const isHidden = hiddenItems.some(
          (hiddenItem) =>
            hiddenItem.type === type &&
            (String(hiddenItem.id) === String(dataId) ||
              hiddenItem.wkt === dataWkt)
        );

        if (isHidden) return;

        try {
          const feature = wktFormat.readFeature(dataWkt, {
            dataProjection: "EPSG:4326",
            featureProjection: "EPSG:3857",
          });

          feature.set("id", dataId);
          feature.set("wkt", dataWkt);
          feature.set("featureType", type);
          feature.set("name", dataName);
          feature.set("color", dataColor);
          feature.set("description", dataDescription);
          feature.set("createdDate", dataCreatedDate);

          feature.setStyle(
            initialMapPageStateRef.current
              .visibleLayers[type] !== false
              ? createFeatureStyle(type, dataColor)
              : new Style({})
          );
          vectorSource.addFeature(feature);
        } catch (wktError) {
          // Tek bir bozuk WKT yüzünden bütün harita yüklemesi durmasın.
          console.error(
            `${type} WKT okunamadı. ID: ${dataId}`,
            dataWkt,
            wktError
          );
        }
      });
    });
  } catch (error) {
    console.error("Kullanıcı geometrileri yüklenemedi:", error);
    console.error("Backend cevabı:", error.response?.data);

    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
      return;
    }

    const backendMessage =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message;

    alert(
      "Harita verileri yüklenemedi.\n\n" +
        (backendMessage || "Bilinmeyen hata oluştu.")
    );
  }
};



  const loadPoiCategories = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/PoiCategories/tree`,
        getAuthConfig()
      );

      setPoiCategories(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log("POI kategorileri yüklenemedi:", error);
    }
  };

  const buildJourneyPoiOptions = (features) => {
    return (Array.isArray(features) ? features : [])
      .map((feature) => {
        const geometry = feature?.getGeometry?.();

        if (
          !geometry ||
          geometry.getType?.() !== "Point"
        ) {
          return null;
        }

        const coordinate =
          geometry.getCoordinates?.();

        if (
          !Array.isArray(coordinate) ||
          coordinate.length < 2
        ) {
          return null;
        }

        const lonLat =
          toLonLat(coordinate);

        const longitude =
          Number(lonLat?.[0]);

        const latitude =
          Number(lonLat?.[1]);

        if (
          !Number.isFinite(longitude) ||
          !Number.isFinite(latitude)
        ) {
          return null;
        }

        return {
          id:
            feature.get("id"),
          name:
            feature.get("name") ||
            "İsimsiz POI",
          categoryName:
            feature.get("categoryName") ||
            "",
          parentCategoryName:
            feature.get("parentCategoryName") ||
            "",
          longitude,
          latitude,
        };
      })
      .filter(Boolean)
      .sort((left, right) =>
        String(left.name).localeCompare(
          String(right.name),
          "tr-TR"
        )
      );
  };

  const loadPois = async () => {
    const poiSource = poiSourceRef.current;
    if (!poiSource) return;

    const geoJson = new GeoJSON();
    const wktFormat = new WKT();

    try {
      // GeoServer yoksa (canlı sürüm) doğrudan POI API'sine geç.
      if (!GEOSERVER_ENABLED) {
        throw new Error("GeoServer devre dışı");
      }

      // Öncelik GeoServer görünümünde. Mevcut POI yapısı korunur.
      const response = await axios.get(
        `${API_BASE_URL}/api/GeoServer/features/vw_pois`
      );

      const features = geoJson.readFeatures(response.data, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });

      poiSource.clear();

      features.forEach((feature) => {
        const props = feature.getProperties();

        feature.set("featureType", "Poi");
        feature.set("id", props.Id ?? props.id);
        feature.set("name", props.Name ?? props.name ?? "");
        feature.set(
          "poiCategoryId",
          props.PoiCategoryId ?? props.poiCategoryId
        );
        feature.set(
          "categoryName",
          props.CategoryName ?? props.categoryName ?? ""
        );
        feature.set(
          "parentCategoryName",
          props.ParentCategoryName ?? props.parentCategoryName ?? ""
        );
        feature.set(
          "openingTime",
          props.OpeningTime ?? props.openingTime ?? ""
        );
        feature.set(
          "closingTime",
          props.ClosingTime ?? props.closingTime ?? ""
        );
        feature.set("username", props.Username ?? props.username ?? "");
        feature.set(
          "createdDate",
          props.CreatedDate ?? props.createdDate ?? ""
        );

        poiSource.addFeature(feature);
      });

      poiSource.changed();

      setJourneyPoiOptions(
        buildJourneyPoiOptions(
          poiSource.getFeatures()
        )
      );

      return;
    } catch (geoServerError) {
      console.warn(
        "GeoServer vw_pois yüklenemedi, POI API yedeği deneniyor:",
        geoServerError
      );
    }

    try {
      // GeoServer geçici olarak yanıt vermezse POI'ler kaybolmasın.
      const response = await axios.get(
        `${API_BASE_URL}/api/Pois`,
        getAuthConfig()
      );

      const items = Array.isArray(response.data) ? response.data : [];
      const fallbackFeatures = [];

      items.forEach((item) => {
        const dataWkt = item.wkt ?? item.Wkt;
        if (!dataWkt) return;

        try {
          const feature = wktFormat.readFeature(dataWkt, {
            dataProjection: "EPSG:4326",
            featureProjection: "EPSG:3857",
          });

          feature.set("featureType", "Poi");
          feature.set("id", item.id ?? item.Id);
          feature.set("name", item.name ?? item.Name ?? "");
          feature.set(
            "poiCategoryId",
            item.poiCategoryId ?? item.PoiCategoryId
          );
          feature.set(
            "categoryName",
            item.categoryName ?? item.CategoryName ?? ""
          );
          feature.set(
            "parentCategoryName",
            item.parentCategoryName ?? item.ParentCategoryName ?? ""
          );
          feature.set(
            "openingTime",
            item.openingTime ?? item.OpeningTime ?? ""
          );
          feature.set(
            "closingTime",
            item.closingTime ?? item.ClosingTime ?? ""
          );
          feature.set("username", item.username ?? item.Username ?? "");
          feature.set(
            "createdDate",
            item.createdDate ?? item.CreatedDate ?? ""
          );

          fallbackFeatures.push(feature);
        } catch (wktError) {
          console.error("POI WKT okunamadı:", dataWkt, wktError);
        }
      });

      poiSource.clear();
      poiSource.addFeatures(fallbackFeatures);
      poiSource.changed();

      setJourneyPoiOptions(
        buildJourneyPoiOptions(
          fallbackFeatures
        )
      );
    } catch (apiError) {
      console.error("POI kayıtları yüklenemedi:", apiError);
      console.error("Backend cevabı:", apiError.response?.data);
    }
  };

  const loadTransitRoutes = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/TransitRoutes`,
        getAuthConfig()
      );

      const routeItems = Array.isArray(response.data)
        ? response.data
        : [];

      setTransitRoutes(routeItems);
      drawGeneratedTransitRoutes(routeItems);

      const vehicleConnection = getVehicleConnection();
      if (vehicleConnection) {
        for (const route of routeItems) {
          const routeId = Number(route.id ?? route.Id);

          if (
            Number.isInteger(routeId) &&
            routeId > 0 &&
            !joinedVehicleRouteIdsRef.current.has(routeId)
          ) {
            try {
              await joinVehicleRoute(routeId);
              joinedVehicleRouteIdsRef.current.add(routeId);
            } catch (joinError) {
              console.warn(
                `Araç güzergah grubuna katılınamadı. RouteId: ${routeId}`,
                joinError
              );
            }
          }
        }
      }

      return routeItems;
    } catch (error) {
      console.log("Güzergahlar yüklenemedi:", error);
      setTransitRoutes([]);
      drawGeneratedTransitRoutes([]);
      return [];
    }
  };

  const loadTransitStops = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/TransitStops`,
        getAuthConfig()
      );

      const source = transitStopSourceRef.current;
      if (!source) return;

      source.clear();
      const format = new WKT();
      const items = Array.isArray(response.data) ? response.data : [];

      items.forEach((item) => {
        const wkt = item.wkt ?? item.Wkt;
        if (!wkt) return;

        try {
          const feature = format.readFeature(wkt, {
            dataProjection: "EPSG:4326",
            featureProjection: "EPSG:3857",
          });

          feature.set("featureType", "TransitStop");
          feature.set("id", item.id ?? item.Id);
          feature.set("name", item.name ?? item.Name ?? "");
          feature.set("transitRouteId", item.transitRouteId ?? item.TransitRouteId);
          feature.set("routeName", item.routeName ?? item.RouteName ?? "");
          feature.set(
            "routeShortCode",
            item.routeShortCode ??
              item.RouteShortCode ??
              item.shortCode ??
              item.ShortCode ??
              item.code ??
              item.Code ??
              ""
          );
          feature.set("routeColor", item.routeColor ?? item.RouteColor ?? "#2563eb");
          feature.set("orderNo", item.orderNo ?? item.OrderNo ?? 0);
          feature.set(
            "stopType",
            item.stopType ?? item.StopType ?? "Bus"
          );
          feature.set("username", item.username ?? item.Username ?? "");
          feature.set("createdDate", item.createdDate ?? item.CreatedDate ?? "");
          feature.set("wkt", wkt);
          source.addFeature(feature);
        } catch (error) {
          console.error("Durak WKT okunamadı:", wkt, error);
        }
      });

      drawGeneratedTransitRoutes(transitRoutes);
    } catch (error) {
      console.log("Duraklar yüklenemedi:", error);
    }
  };

  const openTransitStopInfo = (feature) => {
    if (!feature || feature.get("featureType") !== "TransitStop") return;

    const selectedRouteId = feature.get("transitRouteId");

    const routeStops = (
      transitStopSourceRef.current?.getFeatures() || []
    )
      .filter(
        (stopFeature) =>
          stopFeature.get("featureType") === "TransitStop" &&
          String(stopFeature.get("transitRouteId")) ===
            String(selectedRouteId)
      )
      .sort((firstStop, secondStop) => {
        const firstOrder = Number(firstStop.get("orderNo") ?? 0);
        const secondOrder = Number(secondStop.get("orderNo") ?? 0);

        if (firstOrder !== secondOrder) {
          return firstOrder - secondOrder;
        }

        return (
          Number(firstStop.get("id") ?? 0) -
          Number(secondStop.get("id") ?? 0)
        );
      })
      .map((stopFeature) => ({
        id: stopFeature.get("id"),
        name: stopFeature.get("name") || "İsimsiz Durak",
        orderNo: stopFeature.get("orderNo") || "-",
      }));

    setSelectedTransitStop({
      id: feature.get("id"),
      name: feature.get("name"),
      transitRouteId: selectedRouteId,
      routeName: feature.get("routeName"),
      routeShortCode: feature.get("routeShortCode") || "",
      routeColor: feature.get("routeColor") || "#2563eb",
      orderNo: feature.get("orderNo"),
      stopType: feature.get("stopType") || "Bus",
      username: feature.get("username"),
      createdDate: feature.get("createdDate"),
      routeStops,
    });

    setOverlapModalOpen(false);
    setOverlapFeatures([]);
    setTransitStopInfoOpen(true);
  };

  const loadAuthorizedAreas = async () => {
    try {
      const source = authAreaSourceRef.current;
      if (!source) return;

      source.clear();

      const hasGlobalDrawingAccess =
        await refreshGlobalDrawingAccess();

      /*
        Admin veya Operatör ise coğrafi yetki poligonuna ihtiyaç yoktur.
        Haritada eski bir yetki sınırı kalmaması için source temizlenir.
      */
      if (hasGlobalDrawingAccess) {
        return;
      }

      const response = await axios.get(
        `${API_BASE_URL}/api/geographicauthorizations/my-areas`,
        getAuthConfig()
      );

      const wktFormat = new WKT();

      response.data.forEach((area) => {
        const feature = wktFormat.readFeature(area.wkt, {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857",
        });

        feature.set("featureType", "AuthorizedArea");
        feature.setStyle(createFeatureStyle("AuthorizedArea"));

        source.addFeature(feature);
      });
    } catch (error) {
      console.log("Coğrafi yetki alanları yüklenemedi:", error);
    }
  };

  // Bir koordinatın herhangi bir yetki alanının içinde veya sınırında olup
  // olmadığını kontrol eder. Sadece extent kesişimine bakılmaz.
  const isCoordinateInsideAuthorizedAreas = (coordinate) => {
    const authSource = authAreaSourceRef.current;
    if (!authSource || !coordinate) return false;

    const authAreas = authSource.getFeatures();
    if (authAreas.length === 0) return false;

    return authAreas.some((areaFeature) => {
      const areaGeometry = areaFeature.getGeometry();
      if (!areaGeometry) return false;

      if (areaGeometry.intersectsCoordinate(coordinate)) {
        return true;
      }

      // OpenLayers bazı durumlarda tam sınır üzerindeki noktayı içeride
      // saymayabilir. Çok küçük toleransla sınır üzerini de kabul ediyoruz.
      const closestPoint = areaGeometry.getClosestPoint(coordinate);
      if (!closestPoint) return false;

      const dx = closestPoint[0] - coordinate[0];
      const dy = closestPoint[1] - coordinate[1];
      const distanceSquared = dx * dx + dy * dy;

      return distanceSquared <= 0.25; // EPSG:3857'de yaklaşık 0.5 metre
    });
  };

  // İki koordinat arasını sık aralıklarla kontrol eder. Böylece başlangıç ve
  // bitiş noktaları içeride olsa bile aradaki çizgi yetki alanının dışına
  // çıkarsa çizim kabul edilmez.
  const isSegmentInsideAuthorizedAreas = (start, end) => {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const distance = Math.sqrt(dx * dx + dy * dy);

    // En fazla 25 metrelik aralıklarla kontrol edilir.
    const stepCount = Math.max(1, Math.ceil(distance / 25));

    for (let i = 0; i <= stepCount; i++) {
      const ratio = i / stepCount;
      const coordinate = [
        start[0] + dx * ratio,
        start[1] + dy * ratio,
      ];

      if (!isCoordinateInsideAuthorizedAreas(coordinate)) {
        return false;
      }
    }

    return true;
  };

  const isCoordinateSequenceInsideAuthorizedAreas = (coordinates) => {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return false;

    for (let i = 0; i < coordinates.length; i++) {
      if (!isCoordinateInsideAuthorizedAreas(coordinates[i])) {
        return false;
      }

      if (
        i < coordinates.length - 1 &&
        !isSegmentInsideAuthorizedAreas(coordinates[i], coordinates[i + 1])
      ) {
        return false;
      }
    }

    return true;
  };

  // Point, LineString, Polygon ve Multi türlerinin TAMAMININ yetki alanı
  // içinde kalıp kalmadığını kontrol eder.
  const isGeometryInsideAuthorizedArea = (feature) => {
    /*
      Admin ve Operatör: haritanın tamamında Point, LineString, Polygon,
      POI ve Durak çizebilir. Diğer roller mevcut coğrafi yetki alanı
      kontrolünden geçmeye devam eder.
    */
    if (hasGlobalDrawingAccessRef.current) {
      return true;
    }

    const geometry = feature?.getGeometry();
    if (!geometry) return false;

    const geometryType = geometry.getType();
    const coordinates = geometry.getCoordinates();

    if (geometryType === "Point") {
      return isCoordinateInsideAuthorizedAreas(coordinates);
    }

    if (geometryType === "MultiPoint") {
      return coordinates.every(isCoordinateInsideAuthorizedAreas);
    }

    if (geometryType === "LineString") {
      return isCoordinateSequenceInsideAuthorizedAreas(coordinates);
    }

    if (geometryType === "MultiLineString") {
      return coordinates.every(isCoordinateSequenceInsideAuthorizedAreas);
    }

    if (geometryType === "Polygon") {
      return coordinates.every(isCoordinateSequenceInsideAuthorizedAreas);
    }

    if (geometryType === "MultiPolygon") {
      return coordinates.every((polygonCoordinates) =>
        polygonCoordinates.every(isCoordinateSequenceInsideAuthorizedAreas)
      );
    }

    return false;
  };

  const openVehicleInfo = (feature) => {
    if (
      !feature ||
      feature.get("featureType") !==
        "TransitVehicle"
    ) {
      return;
    }

    const routeId = Number(
      feature.get("transitRouteId")
    );

    const simulationId = String(
      feature.get("simulationId") || ""
    ).trim();

    if (!simulationId) {
      return;
    }

    const geometryCoordinate =
      feature
        .getGeometry()
        ?.getCoordinates();

    const lonLat = geometryCoordinate
      ? toLonLat(geometryCoordinate)
      : [
          feature.get("longitude"),
          feature.get("latitude"),
        ];

    selectedVehicleSimulationIdRef.current =
      simulationId;

    setSelectedVehicle({
      simulationId,

      backendSimulationId:
        feature.get("backendSimulationId") ||
        simulationId,

      tripId:
        feature.get("tripId") ??
        null,

      tripCode:
        feature.get("tripCode") ||
        "",

      vehicleCode:
        feature.get("vehicleCode") ||
        "",

      serviceDate:
        feature.get("serviceDate") ??
        null,

      departureTime:
        feature.get("departureTime") ??
        null,

      isAutomatic:
        feature.get("isAutomatic") === true,

      routeId,

      routeName:
        feature.get("routeName") ||
        "Güzergah belirtilmedi",

      shortCode:
        feature.get("shortCode") ||
        "-",

      routeColor:
        feature.get("routeColor") ||
        "#2563eb",

      vehicleType:
        feature.get("vehicleType") ||
        "Bus",

      progress: Number(
        feature.get("progress") ||
          0
      ),

      isRunning:
        feature.get("isRunning") !==
        false,

      currentSpeedKmh: Number(
        feature.get("currentSpeedKmh") ||
          0
      ),

      maxSpeedKmh: Number(
        feature.get("maxSpeedKmh") ||
          0
      ),

      travelledDistanceMeters: Number(
        feature.get(
          "travelledDistanceMeters"
        ) || 0
      ),

      routeLengthMeters: Number(
        feature.get("routeLengthMeters") ||
          0
      ),

      previousStopId:
        feature.get("previousStopId") ??
        null,

      previousStopName:
        feature.get("previousStopName") ||
        "",

      nextStopId:
        feature.get("nextStopId") ??
        null,

      nextStopName:
        feature.get("nextStopName") ||
        "",

      distanceToNextStopMeters: Number(
        feature.get(
          "distanceToNextStopMeters"
        )
      ),

      estimatedArrivalSeconds: Number(
        feature.get(
          "estimatedArrivalSeconds"
        )
      ),

      isWaitingAtStop:
        feature.get("isWaitingAtStop") ===
        true,

      waitingStopId:
        feature.get("waitingStopId") ??
        null,

      waitingStopName:
        feature.get("waitingStopName") ||
        "",

      currentStopWaitSeconds: Number(
        feature.get(
          "currentStopWaitSeconds"
        ) || 0
      ),

      stopDwellDurationSeconds: Number(
        feature.get(
          "stopDwellDurationSeconds"
        ) || 0
      ),

      remainingStopWaitSeconds: Number(
        feature.get(
          "remainingStopWaitSeconds"
        ) || 0
      ),

      status:
        feature.get("status") ||
        "",

      longitude:
        Number(lonLat?.[0]),

      latitude:
        Number(lonLat?.[1]),

      lastUpdated:
        feature.get("lastUpdated") ||
        new Date().toISOString(),

      routeStops:
        getVehicleRouteStops(routeId),
    });

    setOverlapModalOpen(false);
    setOverlapFeatures([]);
    setVehicleInfoOpen(true);
  };

  const startFollowingVehicle = () => {
    const simulationId = String(
      selectedVehicle?.simulationId ||
        ""
    ).trim();

    if (!simulationId) {
      return;
    }

    followingVehicleSimulationIdRef.current =
      simulationId;

    setFollowingVehicleSimulationId(
      simulationId
    );

    const vehicleFeature =
      vehicleSourceRef.current
        ?.getFeatures()
        .find(
          (feature) =>
            String(
              feature.get("simulationId") ||
                ""
            ) === simulationId
        );

    const coordinate =
      vehicleFeature
        ?.getGeometry()
        ?.getCoordinates();

    const view =
      mapObjectRef.current?.getView();

    if (coordinate && view) {
      view.animate({
        center: coordinate,
        zoom: 15,
        duration: 800,
      });
    }
  };

  const stopFollowingVehicle = () => {
    followingVehicleSimulationIdRef.current =
      null;

    setFollowingVehicleSimulationId(
      null
    );
  };

  const closeVehicleInfo = () => {
    selectedVehicleSimulationIdRef.current =
      null;

    setVehicleInfoOpen(false);
    setSelectedVehicle(null);
  };

  const openPoiInfo = (feature) => {
    if (!feature || feature.get("featureType") !== "Poi") {
      return;
    }

    setSelectedPoi({
      id: feature.get("id"),
      name: feature.get("name"),
      categoryName: feature.get("categoryName"),
      parentCategoryName: feature.get("parentCategoryName"),
      openingTime: feature.get("openingTime"),
      closingTime: feature.get("closingTime"),
      username: feature.get("username"),
      createdDate: feature.get("createdDate"),
    });

    setPoiInfoDetailsOpen(false);
    setOverlapModalOpen(false);
    setOverlapFeatures([]);
    setPoiInfoOpen(true);
  };

  const openFeatureInfo = (feature) => {
    const featureType = feature.get("featureType");

    if (
      featureType !== "Point" &&
      featureType !== "LineString" &&
      featureType !== "Polygon"
    ) {
      return;
    }

    const result =
      featureType === "Polygon" ? calculateInventoryInPolygon(feature) : null;

    setAnalysisResult(result);

    setPendingData({
      type: `${featureType}Info`,
      originalType: featureType,
      feature,
      id: feature.get("id"),
      wkt: feature.get("wkt"),
      name: feature.get("name"),
      color: feature.get("color"),
      description: feature.get("description"),
    });

    setForm({
      name: feature.get("name") || "",
      color: feature.get("color") || "#2563eb",
      description: feature.get("description") || "",
    });

    setIsEditing(false);
    setSaveSuccess(true);
    setOverlapModalOpen(false);
    setOverlapFeatures([]);
    setPopupOpen(true);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/login";
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUsername(
        payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] ||
          payload.unique_name ||
          payload.name ||
          "Kullanıcı"
      );
    } catch {
      setUsername("Kullanıcı");
    }

    axios
      .get(`${API_BASE_URL}/api/users/me`, getAuthConfig())
      .then((response) => {
        setProfileImage(response.data.profileImageUrl || "");
      })
      .catch((error) => {
        console.log("Profil bilgisi alınamadı:", error);
      });

    const countdown = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          localStorage.removeItem("token");
          window.location.href = "/login";
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    const vectorSource = new VectorSource();
    sourceRef.current = vectorSource;

    const poiSource = new VectorSource();
    poiSourceRef.current = poiSource;

    const transitStopSource = new VectorSource();
    transitStopSourceRef.current = transitStopSource;

    const transitRouteLineSource = new VectorSource();
    transitRouteLineSourceRef.current = transitRouteLineSource;

    const vehicleSource = new VectorSource();
    vehicleSourceRef.current = vehicleSource;

    const authAreaSource = new VectorSource();
    authAreaSourceRef.current = authAreaSource;

    const locationAnalysisSource = new VectorSource();
    locationAnalysisSourceRef.current = locationAnalysisSource;
    
    const transitJourneySource = new VectorSource();
    transitJourneySourceRef.current = transitJourneySource;

    const vectorLayer = new VectorLayer({
      source: vectorSource,
    });

    const poiLayer = new VectorLayer({
  source: poiSource,

  style: (feature, resolution) => {
    if (
      showOnlyOpenPoisRef.current &&
      !isPoiOpenNow(
        feature.get("openingTime"),
        feature.get("closingTime")
      )
    ) {
      return [];
    }

    const selectedCategories = selectedPoiCategoriesRef.current;
    const featureParentCategory = String(
      feature.get("parentCategoryName") || ""
    )
      .trim()
      .toLocaleLowerCase("tr-TR");

    if (
      selectedCategories.length > 0 &&
      !selectedCategories.some(
        (categoryName) =>
          String(categoryName || "")
            .trim()
            .toLocaleLowerCase("tr-TR") === featureParentCategory
      )
    ) {
      return [];
    }

    const zoom =
      mapObjectRef.current
        ?.getView()
        ?.getZoomForResolution(resolution) ?? 0;

    const showName = zoom >= 9;

    return createPoiStyle(
      feature.get("parentCategoryName"),
      feature.get("name"),
      showName
    );
  },

  zIndex: 30,
  visible: visiblePois,
});

poiLayerRef.current = poiLayer;

const transitRouteLineLayer = new VectorLayer({
  source: transitRouteLineSource,
  style: (feature, resolution) =>
    createTransitRouteLineStyle(feature, resolution),
  zIndex: 32,
});
transitRouteLineLayerRef.current = transitRouteLineLayer;

const transitStopLayer = new VectorLayer({
  source: transitStopSource,
  style: (feature, resolution) => {
    const stopType =
      String(feature.get("stopType") || "Bus").toLowerCase() === "metro"
        ? "Metro"
        : "Bus";

    if (visibleTransitStopTypesRef.current[stopType] === false) {
      return [];
    }

    const routeId = Number(
      feature.get("transitRouteId")
    );

    if (
      Number.isInteger(routeId) &&
      hiddenTransitRouteIdsRef.current.has(routeId)
    ) {
      return [];
    }

    const zoom =
      mapObjectRef.current
        ?.getView()
        ?.getZoomForResolution(resolution) ?? 0;

    return createTransitStopStyle(
      feature.get("routeColor") ||
        (stopType === "Metro" ? "#7c3aed" : "#2563eb"),
      feature.get("name") || "",
      zoom >= 11,
      stopType,
      feature.get("routeShortCode") || ""
    );
  },
  zIndex: 35,
});
transitStopLayerRef.current = transitStopLayer;

const vehicleLayer = new VectorLayer({
  source: vehicleSource,
  style: (feature) => createVehicleStyle(feature),
  zIndex: 140,
});
vehicleLayerRef.current = vehicleLayer;

const currentUserId = getCurrentUserId();

const pointWmsLayer = createWmsLayer("Points", currentUserId);
pointWmsLayerRef.current = pointWmsLayer;
const lineWmsLayer = createWmsLayer("Lines", currentUserId);
const polygonWmsLayer = createWmsLayer("Polygons", currentUserId);
    const authAreaLayer = new VectorLayer({
      source: authAreaSource,
      style: createFeatureStyle("AuthorizedArea"),
    });

    const locationAnalysisLayer = new VectorLayer({
      source: locationAnalysisSource,
      style: createFeatureStyle("LocationAnalysisArea"),
      zIndex: 80,
    });

    locationAnalysisLayerRef.current = locationAnalysisLayer;

    const transitJourneyLayer = new VectorLayer({
      source: transitJourneySource,
      zIndex: 205,
    });

    transitJourneyLayerRef.current =
      transitJourneyLayer;

    const map = new Map({
      target: mapRef.current,
  layers: [
  new TileLayer({
    source: new OSM(),
  }),

  authAreaLayer,
  vectorLayer,
  poiLayer,
  transitRouteLineLayer,
  transitStopLayer,
  locationAnalysisLayer,
  transitJourneyLayer,
  vehicleLayer,
],
      view: new View({
        center:
          initialMapPageStateRef.current.center,
        zoom:
          initialMapPageStateRef.current.zoom,
      }),
    });

    mapObjectRef.current = map;

    pointWmsLayer.setVisible(
      initialMapPageStateRef.current.visibleLayers
        .Point
    );

    loadSavedGeometries(vectorSource);
    loadAuthorizedAreas();
    loadPoiCategories();
    loadPois();
    loadTransitRoutes();
    loadTransitStops();

    const saveCurrentMapView = () => {
      const view = map.getView();
      const center = view.getCenter();
      const zoom = view.getZoom();

      if (
        !Array.isArray(center) ||
        center.length < 2 ||
        !Number.isFinite(center[0]) ||
        !Number.isFinite(center[1]) ||
        !Number.isFinite(zoom)
      ) {
        return;
      }

      writeMapPageState({
        center: [center[0], center[1]],
        zoom,
      });
    };

    map.on("moveend", saveCurrentMapView);

    map.on("singleclick", (event) => {
      const journeySelectionMode =
        transitJourneySelectionModeRef.current;

      if (
        journeySelectionMode === "start" ||
        journeySelectionMode === "end"
      ) {
        handleTransitJourneyMapPointSelection(
          event.coordinate,
          journeySelectionMode
        );
        return;
      }

if (
  suppressMapClickRef.current ||
  drawRef.current ||
  activeToolRef.current === "Point" ||
  activeToolRef.current === "LineString" ||
  activeToolRef.current === "Polygon" ||
  activeToolRef.current === "Inventory" ||
  activeToolRef.current === "Poi" ||
  activeToolRef.current === "TransitStop"
) {
  return;
}
      if (isGeometryEditingRef.current) return;

      const features = map.getFeaturesAtPixel(event.pixel, {
        hitTolerance: 8,
      });

      const clickedVehicle = features.find(
        (feature) => feature.get("featureType") === "TransitVehicle"
      );

      // Araç, rota veya durakla üst üste gelse bile doğrudan araç kartını aç.
      if (clickedVehicle) {
        openVehicleInfo(clickedVehicle);
        return;
      }

      const clickedFeatures = [];

      features.forEach((feature) => {
        const featureType = feature.get("featureType");

        if (featureType === "TransitStop") {
          const exists = clickedFeatures.some(
            (x) =>
              x.get("id") === feature.get("id") &&
              x.get("featureType") === "TransitStop"
          );

          if (!exists) clickedFeatures.push(feature);
          return;
        }

        if (featureType === "Poi") {
          const exists = clickedFeatures.some(
            (x) =>
              x.get("id") === feature.get("id") &&
              x.get("featureType") === "Poi"
          );

          if (!exists) {
            clickedFeatures.push(feature);
          }

          return;
        }

        if (
          featureType === "Point" ||
          featureType === "LineString" ||
          featureType === "Polygon"
        ) {
          const exists = clickedFeatures.some(
            (x) =>
              x.get("id") === feature.get("id") &&
              x.get("featureType") === feature.get("featureType")
          );

          if (!exists) {
            clickedFeatures.push(feature);
          }
        }
      });

      if (clickedFeatures.length === 0) return;

      if (clickedFeatures.length === 1) {
        const clickedFeature = clickedFeatures[0];

        if (clickedFeature.get("featureType") === "TransitStop") {
          openTransitStopInfo(clickedFeature);
          return;
        }

        if (clickedFeature.get("featureType") === "Poi") {
          openPoiInfo(clickedFeature);
          return;
        }

        openFeatureInfo(clickedFeature);
        return;
      }

      setOverlapFeatures(clickedFeatures);
      setOverlapModalOpen(true);
    });

    return () => {
      clearInterval(countdown);
      map.un("moveend", saveCurrentMapView);

      heatmapLayerRef.current.forEach((layer) => {
        map.removeLayer(layer);
      });
      heatmapLayerRef.current = [];

      vehicleAnimationFramesRef.current.forEach(
        (frameId) => {
          cancelAnimationFrame(frameId);
        }
      );
      vehicleAnimationFramesRef.current.clear();
      vehicleLastUpdateTimesRef.current.clear();

      pointWmsLayerRef.current = null;
      poiLayerRef.current = null;
      transitStopLayerRef.current = null;
      transitStopSourceRef.current = null;
      transitRouteLineLayerRef.current = null;
      transitRouteLineSourceRef.current = null;
      vehicleLayerRef.current = null;
      vehicleSourceRef.current = null;

      if (locationAnalysisHeatmapLayerRef.current) {
        map.removeLayer(locationAnalysisHeatmapLayerRef.current);
        locationAnalysisHeatmapLayerRef.current = null;
      }

      locationAnalysisLayerRef.current = null;
      locationAnalysisSourceRef.current = null;
      locationAnalysisAreaRef.current = null;
      transitJourneyLayerRef.current = null;
      transitJourneySourceRef.current = null;

      Object.values(
        thematicLayerRefs.current
      ).forEach((layer) => {
        if (layer) {
          map.removeLayer(layer);
        }
      });

      thematicLayerRefs.current = {
        stopHeatmap: null,
        poiHeatmap: null,
        walkingAccess: null,
        poiAccessibility: null,
        routeCoverage: null,
      };

      map.setTarget(undefined);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    let disposed = false;
    let activeConnection = null;

    const handleVehicleLocationUpdated = (simulationData) => {
      if (!disposed) {
        upsertVehicleFeature(simulationData);
      }
    };

    const handleVehicleSimulationStopped = (simulationData) => {
      if (!disposed) {
        removeVehicleFeature(simulationData);
      }
    };

    const handleVehicleSimulationCompleted = (simulationData) => {
      if (!disposed) {
        removeVehicleFeature(simulationData);
      }
    };

    const initializeVehicleTracking = async () => {
      if (!token) return;

      try {
        activeConnection = await startVehicleConnection(token);

        activeConnection.off(
          "VehicleLocationUpdated",
          handleVehicleLocationUpdated
        );
        activeConnection.off(
          "VehicleSimulationStopped",
          handleVehicleSimulationStopped
        );
        activeConnection.off(
          "VehicleSimulationCompleted",
          handleVehicleSimulationCompleted
        );

        activeConnection.on(
          "VehicleLocationUpdated",
          handleVehicleLocationUpdated
        );
        activeConnection.on(
          "VehicleSimulationStopped",
          handleVehicleSimulationStopped
        );
        activeConnection.on(
          "VehicleSimulationCompleted",
          handleVehicleSimulationCompleted
        );

        const routesResponse = await axios.get(
          `${API_BASE_URL}/api/TransitRoutes`,
          getAuthConfig()
        );

        const routeItems = Array.isArray(routesResponse.data)
          ? routesResponse.data
          : [];

        for (const route of routeItems) {
          if (disposed) break;

          const routeId = Number(route.id ?? route.Id);
          if (!Number.isInteger(routeId) || routeId <= 0) continue;

          try {
            await joinVehicleRoute(routeId);
            joinedVehicleRouteIdsRef.current.add(routeId);
          } catch (joinError) {
            console.warn(
              `Araç güzergah grubuna katılınamadı. RouteId: ${routeId}`,
              joinError
            );
          }
        }

        const runningResponse = await axios.get(
          `${API_BASE_URL}/api/TransitRoutes/simulations/running`,
          getAuthConfig()
        );

        const runningSimulations = Array.isArray(runningResponse.data)
          ? runningResponse.data
          : [];

        runningSimulations.forEach(upsertVehicleFeature);
      } catch (error) {
        console.error(
          "Canlı araç takip bağlantısı kurulamadı:",
          error
        );
      }
    };

    initializeVehicleTracking();

    // SignalR mesajı kaçarsa veya grup üyeliği gecikirse çalışan araçlar
    // kaybolmasın. Running endpoint'i kısa aralıklarla yedek olarak okunur.
    const runningSimulationRefreshInterval = window.setInterval(async () => {
      if (disposed) return;

      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/TransitRoutes/simulations/running`,
          getAuthConfig()
        );

        const runningItems = Array.isArray(response.data)
          ? response.data
          : [];

        const runningSimulationIds =
          new Set();

        runningItems.forEach((item) => {
          const normalized =
            normalizeVehicleSimulationData(
              item
            );

          if (!normalized) {
            return;
          }

          runningSimulationIds.add(
            normalized.vehicleKey
          );

          upsertVehicleFeature(
            normalized
          );
        });

        vehicleSourceRef.current
          ?.getFeatures()
          .forEach((feature) => {
            const simulationId = String(
              feature.get("simulationId") ||
                ""
            );

            if (
              simulationId &&
              !runningSimulationIds.has(
                simulationId
              )
            ) {
              removeVehicleFeature(
                simulationId
              );
            }
          });
      } catch (pollError) {
        console.warn(
          "Çalışan araçlar yedek sorguyla alınamadı:",
          pollError
        );
      }
    }, 1000);

    return () => {
      window.clearInterval(runningSimulationRefreshInterval);
      disposed = true;

      if (activeConnection) {
        activeConnection.off(
          "VehicleLocationUpdated",
          handleVehicleLocationUpdated
        );
        activeConnection.off(
          "VehicleSimulationStopped",
          handleVehicleSimulationStopped
        );
        activeConnection.off(
          "VehicleSimulationCompleted",
          handleVehicleSimulationCompleted
        );
      }

      const leaveJoinedGroups = async () => {
        for (const routeId of joinedVehicleRouteIdsRef.current) {
          try {
            await leaveVehicleRoute(routeId);
          } catch {
            // Bağlantı kapanırken grup terk hatası kullanıcıya yansıtılmaz.
          }
        }

        joinedVehicleRouteIdsRef.current.clear();

        try {
          await stopVehicleConnection();
        } catch {
          // Sayfadan ayrılırken bağlantı kapatma hatası yoksayılır.
        }
      };

      leaveJoinedGroups();
    };
  }, []);

  useEffect(() => {
    showOnlyOpenPoisRef.current = showOnlyOpenPois;

    writeMapPageState({
      showOnlyOpenPois,
    });

    const refreshPoiVisibility = () => {
      poiSourceRef.current?.changed();
      mapObjectRef.current?.render();
    };

    refreshPoiVisibility();

    if (!showOnlyOpenPois) {
      return undefined;
    }

    // Bilgisayarın yerel saati değiştikçe açık/kapalı durumunu otomatik yeniler.
    const visibilityInterval = window.setInterval(
      refreshPoiVisibility,
      30 * 1000
    );

    return () => {
      window.clearInterval(visibilityInterval);
    };
  }, [showOnlyOpenPois]);

  useEffect(() => {
    selectedPoiCategoriesRef.current = selectedPoiCategories;

    writeMapPageState({
      selectedPoiCategories,
    });

    poiSourceRef.current?.changed();
    mapObjectRef.current?.render();
  }, [selectedPoiCategories]);

  useEffect(() => {
    writeMapPageState({
      visibleLayers,
    });
  }, [visibleLayers]);

  useEffect(() => {
    hiddenTransitRouteIdsRef.current =
      new Set(hiddenTransitRouteIds);

    writeMapPageState({
      hiddenTransitRouteIds,
    });

    transitStopSourceRef.current?.changed();
    drawGeneratedTransitRoutes(transitRoutes);
    mapObjectRef.current?.render();
  }, [hiddenTransitRouteIds, transitRoutes]);

  useEffect(() => {
    visibleTransitStopTypesRef.current =
      visibleTransitStopTypes;

    writeMapPageState({
      visibleTransitStopTypes,
    });

    transitStopSourceRef.current?.changed();

    window.setTimeout(() => {
      drawGeneratedTransitRoutes(transitRoutes);
    }, 0);

    mapObjectRef.current?.render();
  }, [visibleTransitStopTypes, transitRoutes]);

  const zoomToTransitRoute = (routeId) => {
    const map = mapObjectRef.current;
    const normalizedRouteId = Number(routeId);

    if (!map || !Number.isInteger(normalizedRouteId)) {
      return;
    }

    const routeFeature =
      transitRouteLineSourceRef.current
        ?.getFeatures()
        .find(
          (feature) =>
            Number(feature.get("transitRouteId")) ===
            normalizedRouteId
        );

    if (routeFeature?.getGeometry()) {
      map.getView().fit(
        routeFeature.getGeometry().getExtent(),
        {
          padding: [95, 380, 95, 95],
          duration: 700,
          maxZoom: 15,
        }
      );
      return;
    }

    const matchingStops =
      transitStopSourceRef.current
        ?.getFeatures()
        .filter(
          (feature) =>
            feature.get("featureType") ===
              "TransitStop" &&
            Number(
              feature.get("transitRouteId")
            ) === normalizedRouteId
        ) || [];

    if (matchingStops.length === 0) {
      setToastMessage(
        "Bu güzergah için yakınlaştırılacak rota veya durak bulunamadı."
      );
      return;
    }

    const temporarySource = new VectorSource({
      features: matchingStops,
    });

    map.getView().fit(
      temporarySource.getExtent(),
      {
        padding: [95, 380, 95, 95],
        duration: 700,
        maxZoom: 15,
      }
    );
  };

  const isTransitRouteVisible = (routeId) => {
    const normalizedRouteId = Number(routeId);

    if (!Number.isInteger(normalizedRouteId)) {
      return true;
    }

    return !hiddenTransitRouteIds.includes(
      normalizedRouteId
    );
  };

  const toggleTransitRouteVisibility = (routeId) => {
    const normalizedRouteId = Number(routeId);

    if (!Number.isInteger(normalizedRouteId)) {
      return;
    }

    setHiddenTransitRouteIds((currentIds) => {
      const currentlyHidden = currentIds.includes(
        normalizedRouteId
      );

      return currentlyHidden
        ? currentIds.filter(
            (currentId) =>
              currentId !== normalizedRouteId
          )
        : [...currentIds, normalizedRouteId];
    });
  };

  const showAllTransitRoutes = () => {
    setHiddenTransitRouteIds([]);
  };

  const hideAllTransitRoutes = () => {
    setHiddenTransitRouteIds(
      transitRoutes
        .map((route) =>
          Number(route.id ?? route.Id)
        )
        .filter(
          (routeId) =>
            Number.isInteger(routeId) &&
            routeId > 0
        )
    );
  };

  const startDraw = (type) => {
    const map = mapObjectRef.current;
    const vectorSource = sourceRef.current;

    if (!map || !vectorSource) return;

    if (drawRef.current) {
      map.removeInteraction(drawRef.current);
      drawRef.current = null;
    }

    if (modifyRef.current) {
      map.removeInteraction(modifyRef.current);
      modifyRef.current = null;
    }

    isGeometryEditingRef.current = false;
    setIsGeometryEditingOnMap(false);

    activeToolRef.current = type;
    setActiveTool(type);
    setAddMenuOpen(false);
    setLayerMenuOpen(false);
    setQueryPanelOpen(false);

    const draw = new Draw({
      source: vectorSource,
      type,
    });

   draw.on("drawend", async (event) => {
  const allowedArea = isGeometryInsideAuthorizedArea(event.feature);

  if (!allowedArea) {
    const rejectedFeature = event.feature;

    // drawend olayı, OpenLayers özelliği source'a tamamen eklemeden hemen önce
    // çalışabildiği için yalnızca burada removeFeature çağırmak haritada ince bir iz
    // bırakabiliyor. Önce görünmez yapıp etkileşimi kaldırıyoruz, ardından bir sonraki
    // event-loop turunda source'dan kesin olarak siliyoruz.
    if (rejectedFeature) {
      rejectedFeature.setStyle(new Style({}));
    }

    map.removeInteraction(draw);
    drawRef.current = null;
    activeToolRef.current = "";
    setActiveTool("");

    window.setTimeout(() => {
      if (vectorSource && rejectedFeature) {
        vectorSource.removeFeature(rejectedFeature);
        vectorSource.changed();
      }

      map.render();
    }, 0);

    setRegionWarningOpen(true);
    return;
  }

  const format = new WKT();

  const wkt = format.writeFeature(event.feature, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857",
  });

  setPendingData({
    api: getApiUrl(type),
    type,
    wkt,
    feature: event.feature,
  });

  setForm({
    name: "",
    color: "#2563eb",
    description: "",
  });

  setInventoryCount(null);
  setAnalysisResult(null);
  setSaveSuccess(false);
  setIsEditing(false);

  suppressMapClickRef.current = true;
  setPopupOpen(true);

  map.removeInteraction(draw);
  drawRef.current = null;
  activeToolRef.current = "";
  setActiveTool("");

  window.setTimeout(() => {
    suppressMapClickRef.current = false;
  }, 350);
});

    map.addInteraction(draw);
    drawRef.current = draw;
  };


  const resetTransitStopForm = (stopType = "Bus") => {
    setTransitStopForm({
      name: "",
      transitRouteId: "",
      stopType,
    });
  };

  const cancelTransitStopPopup = () => {
    if (pendingTransitStopFeature && transitStopSourceRef.current) {
      transitStopSourceRef.current.removeFeature(pendingTransitStopFeature);
    }

    setPendingTransitStopFeature(null);
    setTransitStopPopupOpen(false);
    setIsSavingTransitStop(false);
    resetTransitStopForm();
    drawGeneratedTransitRoutes(transitRoutes);
  };

  const startTransitStopDraw = async (stopType = "Bus") => {
    const map = mapObjectRef.current;
    const source = transitStopSourceRef.current;
    if (!map || !source) return;

    await loadTransitRoutes();

    if (drawRef.current) {
      map.removeInteraction(drawRef.current);
      drawRef.current = null;
    }

    if (modifyRef.current) {
      map.removeInteraction(modifyRef.current);
      modifyRef.current = null;
    }

    activeToolRef.current = "TransitStop";
    setActiveTool("TransitStop");
    setAddMenuOpen(false);
    setLayerMenuOpen(false);
    setQueryPanelOpen(false);

    const draw = new Draw({
      source,
      type: "Point",
    });

    draw.on("drawend", (event) => {
      const feature = event.feature;

      if (!isGeometryInsideAuthorizedArea(feature)) {
        feature.setStyle(new Style({}));
        map.removeInteraction(draw);
        drawRef.current = null;
        activeToolRef.current = "";
        setActiveTool("");

        window.setTimeout(() => {
          source.removeFeature(feature);
          source.changed();
          map.render();
        }, 0);

        setRegionWarningOpen(true);
        return;
      }

      const normalizedStopType =
        String(stopType || "Bus").toLowerCase() === "metro"
          ? "Metro"
          : "Bus";

      feature.set("featureType", "TransitStopDraft");
      feature.set("stopType", normalizedStopType);
      feature.setStyle(
        createTransitStopStyle(
          normalizedStopType === "Metro" ? "#7c3aed" : "#2563eb",
          "",
          false,
          normalizedStopType
        )
      );
      setPendingTransitStopFeature(feature);
      resetTransitStopForm(normalizedStopType);
      setTransitStopPopupOpen(true);

      map.removeInteraction(draw);
      drawRef.current = null;
      activeToolRef.current = "";
      setActiveTool("");
    });

    map.addInteraction(draw);
    drawRef.current = draw;
  };

  const saveTransitStop = async () => {
  if (!pendingTransitStopFeature) {
    return;
  }

  if (!transitStopForm.name.trim()) {
    alert("Durak adı girmen lazım.");
    return;
  }

  if (!transitStopForm.transitRouteId) {
    alert("Bir güzergah seçmelisin.");
    return;
  }

  try {
    setIsSavingTransitStop(true);

    const routeId = Number(
      transitStopForm.transitRouteId
    );

    const format = new WKT();

    const wkt = format.writeFeature(
      pendingTransitStopFeature,
      {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      }
    );

    /*
     * 1) Önce durağı kaydet.
     */
    await axios.post(
      `${API_BASE_URL}/api/TransitStops`,
      {
        name:
          transitStopForm.name.trim(),

        transitRouteId: routeId,

        stopType:
          transitStopForm.stopType ||
          "Bus",

        wkt,
      },
      getAuthConfig()
    );

    /*
     * 2) Güncel durak listesini backend'den al.
     *
     * Böylece bu güzergah artık kaç durağa sahip
     * kesin olarak öğreniyoruz.
     */
    const stopsResponse =
      await axios.get(
        `${API_BASE_URL}/api/TransitStops?transitRouteId=${routeId}`,
        getAuthConfig()
      );

    const routeStops =
      Array.isArray(stopsResponse.data)
        ? stopsResponse.data
        : [];

    /*
     * 3) En az 2 durak varsa çalışan mevcut
     * generate-route endpointini doğrudan çağır.
     *
     * Bu endpoint:
     *
     * OrderNo
     * → OSRM
     * → RouteWkt
     * → Distance
     * → Duration
     *
     * işlemlerini gerçekleştiriyor.
     */
    if (routeStops.length >= 2) {
      try {
        await axios.post(
          `${API_BASE_URL}/api/TransitRoutes/${routeId}/generate-route`,
          {},
          getAuthConfig()
        );
      } catch (routeError) {
        console.error(
          "Durak kaydedildi fakat OSRM rotası otomatik oluşturulamadı:",
          routeError
        );

        alert(
          routeError.response?.data?.message ||
            routeError.response?.data?.error ||
            "Durak kaydedildi fakat rota otomatik oluşturulamadı."
        );
      }
    }

    /*
     * 4) Haritadaki eski veriyi değil,
     * backend'deki yeni RouteWkt'yi tekrar yükle.
     */
    await loadTransitRoutes();
    await loadTransitStops();

    mapObjectRef.current?.render();

    /*
     * 5) Formu kapat.
     */
    setTransitStopPopupOpen(false);
    setPendingTransitStopFeature(null);
    resetTransitStopForm();

    if (routeStops.length >= 2) {
      setToastMessage(
        "Durak eklendi ve güzergah rotası otomatik güncellendi."
      );
    } else {
      setToastMessage(
        "Durak eklendi. Rota için en az 2 durak gereklidir."
      );
    }

    window.setTimeout(
      () => setToastMessage(""),
      2600
    );
  } catch (error) {
    console.error(
      "Durak kaydetme hatası:",
      error
    );

    alert(
      error.response?.data?.message ||
        error.response?.data?.error ||
        "Durak kaydedilemedi."
    );
  } finally {
    setIsSavingTransitStop(false);
  }
};
  const resetPoiForm = () => {
    setPoiForm({
      name: "",
      parentCategoryId: "",
      poiCategoryId: "",
      openingTime: "09:00",
      closingTime: "18:00",
    });
  };

  const cancelPoiPopup = () => {
    if (pendingPoiFeature && poiSourceRef.current) {
      poiSourceRef.current.removeFeature(pendingPoiFeature);
    }

    setPendingPoiFeature(null);
    setPoiPopupOpen(false);
    setIsSavingPoi(false);
    resetPoiForm();
  };

  const startPoiDraw = () => {
    const map = mapObjectRef.current;
    const poiSource = poiSourceRef.current;

    if (!map || !poiSource) return;

    if (drawRef.current) {
      map.removeInteraction(drawRef.current);
      drawRef.current = null;
    }

    if (modifyRef.current) {
      map.removeInteraction(modifyRef.current);
      modifyRef.current = null;
    }

    activeToolRef.current = "Poi";
    setActiveTool("Poi");
    setAddMenuOpen(false);
    setLayerMenuOpen(false);
    setQueryPanelOpen(false);

    const draw = new Draw({
      source: poiSource,
      type: "Point",
    });

    draw.on("drawend", (event) => {
      const feature = event.feature;

      if (!isGeometryInsideAuthorizedArea(feature)) {
        feature.setStyle(new Style({}));

        map.removeInteraction(draw);
        drawRef.current = null;
        activeToolRef.current = "";
        setActiveTool("");

        window.setTimeout(() => {
          poiSource.removeFeature(feature);
          poiSource.changed();
          map.render();
        }, 0);

        setRegionWarningOpen(true);
        return;
      }

      feature.set("featureType", "PoiDraft");
      feature.setStyle(createPoiStyle(""));

      setPendingPoiFeature(feature);
      resetPoiForm();
      setPoiPopupOpen(true);

      map.removeInteraction(draw);
      drawRef.current = null;
      activeToolRef.current = "";
      setActiveTool("");
    });

    map.addInteraction(draw);
    drawRef.current = draw;
  };

  const savePoi = async () => {
    if (!pendingPoiFeature) return;

    if (!poiForm.name.trim()) {
      alert("POI adı girmen lazım.");
      return;
    }

    if (!poiForm.poiCategoryId) {
      alert("Alt kategori seçmen lazım.");
      return;
    }

    if (!poiForm.openingTime || !poiForm.closingTime) {
      alert("Açılış ve kapanış saatlerini seçmelisin.");
      return;
    }

    if (poiForm.openingTime >= poiForm.closingTime) {
      alert("Kapanış saati açılış saatinden sonra olmalıdır.");
      return;
    }

    try {
      setIsSavingPoi(true);

      const format = new WKT();
      const wkt = format.writeFeature(pendingPoiFeature, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });

      const response = await axios.post(
        `${API_BASE_URL}/api/Pois`,
        {
          name: poiForm.name.trim(),
          poiCategoryId: Number(poiForm.poiCategoryId),
          openingTime: `${poiForm.openingTime}:00`,
          closingTime: `${poiForm.closingTime}:00`,
          wkt,
        },
        getAuthConfig()
      );

      pendingPoiFeature.set("id", response.data.id ?? response.data.Id);
      pendingPoiFeature.set("wkt", wkt);
      pendingPoiFeature.set("featureType", "Poi");
      pendingPoiFeature.set("name", poiForm.name.trim());
      pendingPoiFeature.set(
        "poiCategoryId",
        Number(poiForm.poiCategoryId)
      );

      const parent = poiCategories.find(
        (item) => String(item.id) === String(poiForm.parentCategoryId)
      );
      const child = parent?.children?.find(
        (item) => String(item.id) === String(poiForm.poiCategoryId)
      );

      pendingPoiFeature.set("parentCategoryName", parent?.name ?? "");
      pendingPoiFeature.set("categoryName", child?.name ?? "");
      pendingPoiFeature.set("openingTime", `${poiForm.openingTime}:00`);
      pendingPoiFeature.set("closingTime", `${poiForm.closingTime}:00`);
      pendingPoiFeature.set("username", username);
      pendingPoiFeature.set("createdDate", new Date().toISOString());
      pendingPoiFeature.setStyle(null);

      setPoiPopupOpen(false);
      setPendingPoiFeature(null);
      setIsSavingPoi(false);
      resetPoiForm();

      setToastMessage("POI başarıyla eklendi.");
      window.setTimeout(() => setToastMessage(""), 2200);
    } catch (error) {
      console.log("POI kaydetme hatası:", error);
      console.log("Backend cevap:", error.response?.data);

      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "POI kaydedilemedi.";

      alert(message);
      setIsSavingPoi(false);
    }
  };


  const startLocationAnalysisAreaDraw = () => {
    const map = mapObjectRef.current;
    const analysisSource = locationAnalysisSourceRef.current;

    if (!map || !analysisSource) {
      setToastMessage("Harita henüz hazır değil. Lütfen tekrar dene.");
      window.setTimeout(() => setToastMessage(""), 2200);
      return;
    }

    if (drawRef.current) {
      map.removeInteraction(drawRef.current);
      drawRef.current = null;
    }

    if (modifyRef.current) {
      map.removeInteraction(modifyRef.current);
      modifyRef.current = null;
    }

    clearLocationAnalysisHeatmap();

    analysisSource.clear();
    analysisSource.changed();

    locationAnalysisAreaRef.current = null;
    setLocationAnalysisAreaWkt("");
    setLocationAnalysisAreaSelected(false);

    activeToolRef.current = "LocationAnalysisArea";
    setActiveTool("LocationAnalysisArea");
    setAddMenuOpen(false);
    setLayerMenuOpen(false);
    setQueryPanelOpen(false);
    setPoiInfoOpen(false);
    setPopupOpen(false);
    setLocationAnalysisOpen(false);

    const draw = new Draw({
      source: analysisSource,
      type: "Polygon",
      style: createFeatureStyle("LocationAnalysisArea"),
    });

    draw.on("drawend", (event) => {
      const feature = event.feature;
      const geometry = feature?.getGeometry();

      if (!geometry || geometry.getType() !== "Polygon") {
        analysisSource.removeFeature(feature);
        analysisSource.changed();

        map.removeInteraction(draw);
        drawRef.current = null;
        activeToolRef.current = "";
        setActiveTool("");

        setToastMessage("Geçerli bir polygon alanı çizilemedi.");
        window.setTimeout(() => setToastMessage(""), 2200);
        setLocationAnalysisOpen(true);
        return;
      }

      feature.set("featureType", "LocationAnalysisArea");
      feature.setStyle(createFeatureStyle("LocationAnalysisArea"));

      const format = new WKT();
      const wkt = format.writeFeature(feature, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });

      locationAnalysisAreaRef.current = feature;
      setLocationAnalysisAreaWkt(wkt);
      setLocationAnalysisAreaSelected(true);

      map.removeInteraction(draw);
      drawRef.current = null;
      activeToolRef.current = "";
      setActiveTool("");

      map.getView().fit(geometry.getExtent(), {
        duration: 450,
        padding: [90, 420, 90, 90],
        maxZoom: 14,
      });

      setToastMessage("Konum analizi alanı başarıyla seçildi.");
      window.setTimeout(() => setToastMessage(""), 2200);

      window.setTimeout(() => {
        setLocationAnalysisOpen(true);
      }, 120);
    });

    draw.on("drawabort", () => {
      map.removeInteraction(draw);
      drawRef.current = null;
      activeToolRef.current = "";
      setActiveTool("");
      setLocationAnalysisOpen(true);
    });

    map.addInteraction(draw);
    drawRef.current = draw;
  };

  const clearLocationAnalysisHeatmap = () => {
    const map = mapObjectRef.current;
    const heatmapLayer = locationAnalysisHeatmapLayerRef.current;

    if (map && heatmapLayer) {
      map.removeLayer(heatmapLayer);

      const heatSource = heatmapLayer.getSource?.();
      heatSource?.clear?.();
    }

    locationAnalysisHeatmapLayerRef.current = null;

    if (poiLayerRef.current) {
      poiLayerRef.current.setVisible(true);
      poiLayerRef.current.changed();
    }

    if (locationAnalysisAreaRef.current) {
      locationAnalysisAreaRef.current.setStyle(
        createFeatureStyle("LocationAnalysisArea")
      );
    }

    map?.render();

    setLocationAnalysisRunning(false);
    setLocationAnalysisPoiCount(0);
  };

  const runLocationAnalysis = async (criteria) => {
    const map = mapObjectRef.current;
    const poiSource = poiSourceRef.current;
    const areaFeature = locationAnalysisAreaRef.current;

    if (!map || !poiSource || !areaFeature) {
      throw new Error("Önce haritadan hedef alanı çizmelisin.");
    }

    if (!Array.isArray(criteria) || criteria.length < 2 || criteria.length > 5) {
      throw new Error("En az 2, en fazla 5 kriter seçmelisin.");
    }

    const normalizedCriteria = criteria.map((criterion) => ({
      categoryId: criterion.categoryId,
      categoryName: String(criterion.categoryName || "").trim(),
      categoryType: criterion.categoryType,
      score: Number(criterion.score || 0),
    }));

    if (
      normalizedCriteria.some(
        (criterion) =>
          !criterion.categoryId ||
          !criterion.categoryName ||
          !["parent", "child"].includes(criterion.categoryType)
      )
    ) {
      throw new Error("Bütün kriterlerde geçerli bir kategori seçmelisin.");
    }

    if (
      normalizedCriteria.some(
        (criterion) =>
          !Number.isFinite(criterion.score) ||
          criterion.score <= 0 ||
          criterion.score > 100
      )
    ) {
      throw new Error(
        "Her kriter için 1 ile 100 arasında geçerli bir puan girmelisin."
      );
    }

    const criterionKeys = normalizedCriteria.map(
      (criterion) => `${criterion.categoryType}:${criterion.categoryId}`
    );

    if (new Set(criterionKeys).size !== criterionKeys.length) {
      throw new Error("Aynı kategoriyi birden fazla kriterde seçemezsin.");
    }

    const totalScore = normalizedCriteria.reduce(
      (total, criterion) => total + criterion.score,
      0
    );

    if (totalScore !== 100) {
      throw new Error(
        "Kriter puanlarının toplamı tam olarak 100 olmalıdır."
      );
    }

    const targetGeometry = areaFeature.getGeometry();

    if (!targetGeometry || targetGeometry.getType() !== "Polygon") {
      throw new Error("Seçilen analiz alanı geçerli bir polygon değil.");
    }

    const heatSource = new VectorSource();

    poiSource.getFeatures().forEach((poiFeature) => {
      const geometry = poiFeature.getGeometry();

      if (!geometry || geometry.getType() !== "Point") return;

      const coordinate = geometry.getCoordinates();

      if (!targetGeometry.intersectsCoordinate(coordinate)) {
        return;
      }

      const poiCategoryId = String(
        poiFeature.get("poiCategoryId") ?? ""
      ).trim();

      const parentCategoryName = String(
        poiFeature.get("parentCategoryName") ?? ""
      )
        .trim()
        .toLocaleLowerCase("tr-TR");

      const matchedCriteria = normalizedCriteria.filter((criterion) => {
        if (criterion.categoryType === "parent") {
          return (
            criterion.categoryName.toLocaleLowerCase("tr-TR") ===
            parentCategoryName
          );
        }

        return String(criterion.categoryId) === poiCategoryId;
      });

      if (matchedCriteria.length === 0) return;

      const rawWeight = matchedCriteria.reduce(
        (sum, criterion) => sum + criterion.score / 100,
        0
      );

      const heatFeature = poiFeature.clone();
      heatFeature.set("analysisWeight", Math.max(0.01, Math.min(1, rawWeight)));
      heatFeature.set("featureType", "LocationAnalysisHeatPoint");
      heatFeature.set("matchedCriteriaCount", matchedCriteria.length);
      heatSource.addFeature(heatFeature);
    });

    const matchedPoiCount = heatSource.getFeatures().length;

    if (matchedPoiCount === 0) {
      throw new Error(
        "Seçilen alan ve kriterlerle eşleşen POI bulunamadı. Alanı veya kriterleri değiştir."
      );
    }

    clearLocationAnalysisHeatmap();

    areaFeature.setStyle(createLocationAnalysisResultAreaStyle());

    if (poiLayerRef.current) {
      poiLayerRef.current.setVisible(false);
    }

    const heatmapLayer = new HeatmapLayer({
  source: heatSource,

  blur: 22,
  radius: 24,
  opacity: 0.95,

  weight: (feature) => {
    const value = Number(feature.get("analysisWeight") || 0);

    return Math.max(0.15, Math.min(1, value));
  },

  gradient: [
    "rgba(37, 99, 235, 0)",
    "rgba(34, 197, 94, 0.78)",
    "#84cc16",
    "#fde047",
    "#fb923c",
    "#ef4444",
    "#991b1b",
  ],

  zIndex: 100,
});

    map.addLayer(heatmapLayer);
    locationAnalysisHeatmapLayerRef.current = heatmapLayer;

    setLocationAnalysisPoiCount(matchedPoiCount);
    setLocationAnalysisRunning(true);
    setLocationAnalysisOpen(false);

    map.getView().fit(targetGeometry.getExtent(), {
      duration: 650,
      padding: [90, 420, 90, 90],
      maxZoom: 13,
    });

    setToastMessage(
      `Konum analizi tamamlandı. ${matchedPoiCount} POI değerlendirildi.`
    );
    window.setTimeout(() => setToastMessage(""), 2600);

    return {
      matchedPoiCount,
      criteria: normalizedCriteria,
      areaWkt: locationAnalysisAreaWkt,
    };
  };

  const closeLocationAnalysis = () => {
    setLocationAnalysisOpen(false);
  };

  const resetLocationAnalysis = () => {
    const map = mapObjectRef.current;

    if (
      map &&
      drawRef.current &&
      activeToolRef.current === "LocationAnalysisArea"
    ) {
      map.removeInteraction(drawRef.current);
      drawRef.current = null;
    }

    clearLocationAnalysisHeatmap();

    if (locationAnalysisSourceRef.current) {
      locationAnalysisSourceRef.current.clear();
      locationAnalysisSourceRef.current.changed();
    }

    locationAnalysisAreaRef.current = null;
    activeToolRef.current = "";

    setActiveTool("");
    setLocationAnalysisAreaWkt("");
    setLocationAnalysisAreaSelected(false);
    setLocationAnalysisOpen(true);
  };

  const startInventoryAnalysis = () => {
    const map = mapObjectRef.current;
    const vectorSource = sourceRef.current;

    if (!map || !vectorSource) return;

    if (drawRef.current) {
      map.removeInteraction(drawRef.current);
      drawRef.current = null;
    }

    if (modifyRef.current) {
      map.removeInteraction(modifyRef.current);
      modifyRef.current = null;
    }

    isGeometryEditingRef.current = false;
    setIsGeometryEditingOnMap(false);

activeToolRef.current = "Inventory";
    setActiveTool("Inventory");
    setAddMenuOpen(false);
    setLayerMenuOpen(false);
    setQueryPanelOpen(false);

    const draw = new Draw({
      source: vectorSource,
      type: "Polygon",
    });

    draw.on("drawend", (event) => {
      const analysisFeature = event.feature;

      if (!isGeometryInsideAuthorizedArea(analysisFeature)) {
        analysisFeature.setStyle(new Style({}));

        map.removeInteraction(draw);
        drawRef.current = null;
        activeToolRef.current = "";
        setActiveTool("");

        window.setTimeout(() => {
          vectorSource.removeFeature(analysisFeature);
          vectorSource.changed();
          map.render();
        }, 0);

        setRegionWarningOpen(true);
        return;
      }

      analysisFeature.setStyle(createFeatureStyle("Inventory", "#1e40af"));

      const result = calculateInventoryInPolygon(analysisFeature);

      setAnalysisResult(result);

      setPendingData({
        type: "Inventory",
        feature: analysisFeature,
      });

      setSaveSuccess(true);
      setIsEditing(false);

      suppressMapClickRef.current = true;
      setPopupOpen(true);

      map.removeInteraction(draw);
      drawRef.current = null;
      activeToolRef.current = "";
      setActiveTool("");

      window.setTimeout(() => {
        suppressMapClickRef.current = false;
      }, 350);
    });

    map.addInteraction(draw);
    drawRef.current = draw;
  };

  const closePopup = () => {
  if (modifyRef.current && mapObjectRef.current) {
    mapObjectRef.current.removeInteraction(modifyRef.current);
    modifyRef.current = null;
  }

  // Yeni çizim kaydedilmeden popup kapatıldıysa haritadan da kaldır.
  const isNewUnsavedGeometry =
    pendingData?.feature &&
    !pendingData?.originalType &&
    pendingData?.type !== "Inventory" &&
    !saveSuccess;

  if (isNewUnsavedGeometry && sourceRef.current) {
    sourceRef.current.removeFeature(pendingData.feature);
  }

  if (pendingData?.feature && pendingData?.originalType) {
    pendingData.feature.setStyle(
      createFeatureStyle(
        pendingData.originalType,
        pendingData.feature.get("color") || "#2563eb"
      )
    );
  }

  isGeometryEditingRef.current = false;

  setPopupOpen(false);
  setPendingData(null);
  setInventoryCount(null);
  setAnalysisResult(null);
  setSaveSuccess(false);
  setIsSaving(false);
  setIsEditing(false);
  setDeleteConfirmOpen(false);
  setIsGeometryEditingOnMap(false);
  setEditOriginalWkt("");

  setForm({
    name: "",
    color: "#2563eb",
    description: "",
  });
};

  const saveGeometry = async () => {
    if (!pendingData) return;

    if (!form.name.trim()) {
      alert("İsim girmen lazım.");
      return;
    }

    try {
      setIsSaving(true);

      const response = await axios.post(
        pendingData.api,
        {
          wkt: pendingData.wkt,
          name: form.name,
          color: form.color,
          description: form.description,
        },
        getAuthConfig()
      );

      pendingData.feature.set("id", response.data.id ?? response.data.Id);
      pendingData.feature.set("wkt", pendingData.wkt);
      pendingData.feature.set("featureType", pendingData.type);
      pendingData.feature.set("name", form.name);
      pendingData.feature.set("color", form.color);
      pendingData.feature.set("description", form.description);

      pendingData.feature.setStyle(createFeatureStyle(pendingData.type, form.color));

      if (pendingData.type === "Polygon") {
        const result = calculateInventoryInPolygon(pendingData.feature);
        setInventoryCount(result?.total ?? 0);
      }

      setSaveSuccess(true);
      setIsSaving(false);
    } catch (error) {
      console.log("Kaydetme hatası:", error);
      console.log("Backend cevap:", error.response?.data);

      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        return;
      }

    const errorMessage =
  error.response?.data?.error ||
  error.response?.data?.message ||
  "";

if (errorMessage.includes("Bu bölgede erişiminiz yok")) {
  setRegionWarningOpen(true);
} else {
  alert(
    pendingData.type +
      " kaydedilemedi.\n\n" +
      "Hata: " +
      JSON.stringify(error.response?.data)
  );
}

      setIsSaving(false);
    }
  };

  const startGeometryEdit = () => {
    const map = mapObjectRef.current;

    if (!map || !pendingData?.feature) {
      alert("Düzenlenecek geometri bulunamadı.");
      return;
    }

    if (drawRef.current) {
      map.removeInteraction(drawRef.current);
      drawRef.current = null;
    }

    if (modifyRef.current) {
      map.removeInteraction(modifyRef.current);
      modifyRef.current = null;
    }

    const format = new WKT();

    const originalWkt = format.writeFeature(pendingData.feature, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });

    setEditOriginalWkt(originalWkt);

    pendingData.feature.setStyle(createEditStyle());

    const translate = new Translate({
      features: new Collection([pendingData.feature]),
      hitTolerance: 10,
    });

    map.addInteraction(translate);
    modifyRef.current = translate;

    isGeometryEditingRef.current = true;

    setIsEditing(true);
    setIsGeometryEditingOnMap(true);

    setPopupOpen(false);
  };

  const cancelGeometryEdit = () => {
    const map = mapObjectRef.current;

    if (modifyRef.current && map) {
      map.removeInteraction(modifyRef.current);
      modifyRef.current = null;
    }

    if (pendingData?.feature && editOriginalWkt) {
      const format = new WKT();

      const oldFeature = format.readFeature(editOriginalWkt, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });

      pendingData.feature.setGeometry(oldFeature.getGeometry());

      pendingData.feature.setStyle(
        createFeatureStyle(
          pendingData.originalType,
          pendingData.feature.get("color") || "#2563eb"
        )
      );
    }

    isGeometryEditingRef.current = false;

    setIsGeometryEditingOnMap(false);
    setIsEditing(false);
    setEditOriginalWkt("");
    setPopupOpen(true);
  };

  const updateSelectedGeometry = async () => {
    if (!pendingData?.feature) {
      alert("Güncellenecek geometri bulunamadı.");
      return;
    }

    if (!form.name.trim()) {
      alert("İsim boş olamaz.");
      return;
    }

    const originalType = pendingData.originalType;
    const geometryId = pendingData?.id ?? pendingData.feature.get("id");

    if (!geometryId) {
      alert("Geometri id bulunamadı.");
      return;
    }

    try {
      setIsSaving(true);

      const format = new WKT();

      if (!isGeometryInsideAuthorizedArea(pendingData.feature)) {
        setIsSaving(false);
        setRegionWarningOpen(true);
        return;
      }

      const updatedWkt = format.writeFeature(pendingData.feature, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });

      await axios.put(
        getApiUrl(originalType, geometryId),
        {
          wkt: updatedWkt,
          name: form.name,
          color: form.color,
          description: form.description,
        },
        getAuthConfig()
      );

      pendingData.feature.set("wkt", updatedWkt);
      pendingData.feature.set("name", form.name);
      pendingData.feature.set("color", form.color);
      pendingData.feature.set("description", form.description);
      pendingData.feature.setStyle(createFeatureStyle(originalType, form.color));

      if (modifyRef.current && mapObjectRef.current) {
        mapObjectRef.current.removeInteraction(modifyRef.current);
        modifyRef.current = null;
      }

      isGeometryEditingRef.current = false;

      setPendingData({
        ...pendingData,
        wkt: updatedWkt,
        name: form.name,
        color: form.color,
        description: form.description,
      });

      setIsGeometryEditingOnMap(false);
      setIsEditing(false);
      setIsSaving(false);
      setEditOriginalWkt("");
      setPopupOpen(false);
setPendingData(null);

setToastMessage(
  isGeometryEditingOnMap ? "Konum güncellendi." : "Bilgiler güncellendi."
);

setTimeout(() => {
  setToastMessage("");
}, 2200);
    } catch (error) {
      console.log("Güncelleme hatası:", error);
      console.log("Backend cevap:", error.response?.data);

      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        return;
      }

      alert(
        "Güncelleme yapılamadı.\n\nHata: " +
          JSON.stringify(error.response?.data)
      );

      setIsSaving(false);
    }
  };

  const deleteSelectedGeometry = () => {
    if (!pendingData?.feature) {
      alert("Silinecek geometri bulunamadı.");
      return;
    }

    setDeleteConfirmOpen(true);
  };

  const confirmDeleteGeometry = async () => {
    if (!pendingData?.feature) return;

    const originalType = pendingData.originalType;
    const geometryId = pendingData?.id ?? pendingData.feature.get("id");
    const geometryWkt = pendingData?.wkt ?? pendingData.feature.get("wkt");

    const hiddenItems = getHiddenItems();

    hiddenItems.push({
      type: originalType,
      id: geometryId,
      wkt: geometryWkt,
    });

    setHiddenItems(hiddenItems);

    if (sourceRef.current) {
      sourceRef.current.removeFeature(pendingData.feature);
    }

    setDeleteConfirmOpen(false);
    closePopup();

    if (geometryId) {
      try {
        await axios.delete(getApiUrl(originalType, geometryId), getAuthConfig());
      } catch (error) {
        console.log("DB silinemedi ama siteden gizlendi:", error);

        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          window.location.href = "/login";
        }
      }
    }
  };

  const deleteInventoryArea = () => {
    if (pendingData?.feature && sourceRef.current) {
      sourceRef.current.removeFeature(pendingData.feature);
    }

    closePopup();
  };

  const toggleLayer = (type) => {
    setVisibleLayers((prev) => {
      const updated = {
        ...prev,
        [type]: !prev[type],
      };

      if (type === "Point" && pointWmsLayerRef.current) {
        pointWmsLayerRef.current.setVisible(
          heatmapOpen ? false : updated.Point
        );
      }

      if (sourceRef.current) {
        sourceRef.current.getFeatures().forEach((feature) => {
          const featureType = feature.get("featureType");

          if (featureType === type) {
            const shouldShow = heatmapOpen ? false : updated[type];

            feature.setStyle(
              shouldShow
                ? createFeatureStyle(
                    featureType,
                    feature.get("color") || "#2563eb"
                  )
                : new Style({})
            );
          }
        });
      }

      return updated;
    });
  };

  const togglePois = () => {
    setVisiblePois((currentValue) => {
      const nextValue = !currentValue;

      if (poiLayerRef.current) {
        poiLayerRef.current.setVisible(nextValue);
      }

      return nextValue;
    });
  };

const focusGeometryFromQuery = (item) => {
  if (!mapObjectRef.current || !sourceRef.current) return;

  setPopupOpen(false);
  setPendingData(null);
  setSaveSuccess(false);
  setIsEditing(false);

  const itemId = item.id ?? item.Id;
  const itemName = item.name ?? item.Name;
  const itemType = item.type ?? item.Type;
  const itemWkt = item.wkt ?? item.Wkt;

  const targetType = itemType === "Line" ? "LineString" : itemType;

  let feature = sourceRef.current.getFeatures().find((f) => {
    return (
      String(f.get("id")) === String(itemId) &&
      f.get("featureType") === targetType
    );
  });

  if (!feature) {
    feature = sourceRef.current.getFeatures().find((f) => {
      return (
        f.get("name") === itemName &&
        f.get("featureType") === targetType
      );
    });
  }

  if (!feature && itemWkt) {
    const format = new WKT();

    feature = format.readFeature(itemWkt, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });
  }

  if (!feature) {
  return;
}

  const geometry = feature.getGeometry();

  mapObjectRef.current.getView().fit(geometry.getExtent(), {
    duration: 600,
    padding: [150, 150, 150, 150],
    maxZoom: 16,
  });

  feature.setStyle(createEditStyle());

  setTimeout(() => {
    feature.setStyle(
      createFeatureStyle(targetType, feature.get("color") || "#2563eb")
    );
  }, 2500);

  setQueryPanelOpen(false);
};

  const clearActiveTool = () => {
    activeToolRef.current = "";
    setActiveTool("");
  };

  const logout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const selectedPoiTheme = getPoiCategoryTheme(
    selectedPoi?.parentCategoryName
  );

  const toggleTransitStopType = (stopType) => {
    setVisibleTransitStopTypes((previous) => {
      const next = {
        ...previous,
        [stopType]: !previous[stopType],
      };

      visibleTransitStopTypesRef.current = next;
      transitStopSourceRef.current?.changed();

      window.setTimeout(() => {
        drawGeneratedTransitRoutes(transitRoutes);
      }, 0);

      mapObjectRef.current?.render();

      return next;
    });
  };

  return (
    <div style={styles.page}>
      <style>
        {`
          @keyframes poiInfoSlideIn {
            0% {
              opacity: 0;
              transform: translateX(-115%);
            }

            72% {
              opacity: 1;
              transform: translateX(7px);
            }

            100% {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes locationAnalysisSpin {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .poi-info-slide-card {
              animation: none !important;
            }
          }
        `}
      </style>
      <Topbar
        styles={styles}
        activeTool={activeTool}
        startDraw={startDraw}
        startInventoryAnalysis={startInventoryAnalysis}
        username={username}
        profileImage={profileImage}
        setProfileImage={setProfileImage}
        userMenuOpen={userMenuOpen}
        setUserMenuOpen={setUserMenuOpen}
        minutes={minutes}
        seconds={seconds}
        logout={logout}
        addMenuOpen={addMenuOpen}
        setAddMenuOpen={setAddMenuOpen}
        layerMenuOpen={layerMenuOpen}
        setLayerMenuOpen={setLayerMenuOpen}
        visibleLayers={visibleLayers}
        toggleLayer={toggleLayer}
        visiblePois={visiblePois}
        togglePois={togglePois}
        clearActiveTool={clearActiveTool}
        queryPanelOpen={queryPanelOpen}
        setQueryPanelOpen={setQueryPanelOpen}
        heatmapOpen={heatmapOpen}
        toggleHeatmap={toggleHeatmap}
        startPoiDraw={startPoiDraw}
        startTransitStopDraw={startTransitStopDraw}
        visibleTransitStopTypes={visibleTransitStopTypes}
        toggleTransitStopType={toggleTransitStopType}
        locationAnalysisOpen={locationAnalysisOpen}
         setLocationAnalysisOpen={setLocationAnalysisOpen}
        transitRoutesPanelOpen={transitRoutesPanelOpen}
        onToggleTransitRoutesPanel={() => {
          const shouldOpen = !transitRoutesPanelOpen;

          setTransitRoutesPanelOpen(shouldOpen);
          setTripManagementPanelOpen(false);
          setTransitJourneyPanelOpen(false);
          setThematicMapPanelOpen(false);
          setQueryPanelOpen(false);

          setTransitJourneySelectionMode("");
          transitJourneySelectionModeRef.current = "";
        }}
        tripManagementPanelOpen={tripManagementPanelOpen}
        onToggleTripManagementPanel={() => {
          const shouldOpen = !tripManagementPanelOpen;

          setTripManagementPanelOpen(shouldOpen);
          setTransitRoutesPanelOpen(false);
          setTransitJourneyPanelOpen(false);
          setThematicMapPanelOpen(false);
          setQueryPanelOpen(false);

          setTransitJourneySelectionMode("");
          transitJourneySelectionModeRef.current = "";
        }}
        transitJourneyPanelOpen={transitJourneyPanelOpen}
        onToggleTransitJourneyPanel={() => {
          const shouldOpen = !transitJourneyPanelOpen;

          setTransitJourneyPanelOpen(shouldOpen);
          setTransitRoutesPanelOpen(false);
          setTripManagementPanelOpen(false);
          setThematicMapPanelOpen(false);
          setQueryPanelOpen(false);

          setTransitJourneySelectionMode("");
          transitJourneySelectionModeRef.current = "";
        }}
        thematicMapPanelOpen={thematicMapPanelOpen}
        onToggleThematicMapPanel={() => {
          const shouldOpen = !thematicMapPanelOpen;

          setThematicMapPanelOpen(shouldOpen);
          setTransitRoutesPanelOpen(false);
          setTripManagementPanelOpen(false);
          setTransitJourneyPanelOpen(false);
          setQueryPanelOpen(false);

          setTransitJourneySelectionMode("");
          transitJourneySelectionModeRef.current = "";
        }}

        poiSearchContent={
          <PoiSearchBar
            poiSourceRef={poiSourceRef}
            transitStopSourceRef={transitStopSourceRef}
            transitRoutes={transitRoutes}
            hiddenTransitRouteIds={hiddenTransitRouteIds}
            isTransitRouteVisible={isTransitRouteVisible}
            onToggleTransitRouteVisibility={toggleTransitRouteVisibility}
            onShowAllTransitRoutes={showAllTransitRoutes}
            onHideAllTransitRoutes={hideAllTransitRoutes}
            onZoomToTransitRoute={zoomToTransitRoute}
            mapObjectRef={mapObjectRef}
            openPoiInfo={openPoiInfo}
            openTransitStopInfo={openTransitStopInfo}
            showOnlyOpen={showOnlyOpenPois}
            onShowOnlyOpenChange={setShowOnlyOpenPois}
            categories={poiCategories}
            selectedCategories={selectedPoiCategories}
            onSelectedCategoriesChange={setSelectedPoiCategories}
          />
        }
      />

      {transitRoutesPanelOpen && (
        <TransitRoutesPanel
          onClose={async () => {
            setTransitRoutesPanelOpen(false);
            await loadTransitRoutes();
            await loadTransitStops();
          }}
        />
      )}

      {tripManagementPanelOpen && (
        <TripManagementPanel
          transitRoutes={transitRoutes}
          onClose={() => setTripManagementPanelOpen(false)}
        />
      )}

      <div ref={mapRef} style={styles.map} />

      <ThematicMapPanel
        open={thematicMapPanelOpen}
        themes={thematicThemes}
        counts={{
          stops:
            transitStopSourceRef.current
              ?.getFeatures()
              ?.filter(
                (feature) =>
                  feature.get(
                    "featureType"
                  ) === "TransitStop"
              ).length || 0,
          pois:
            poiSourceRef.current
              ?.getFeatures()
              ?.filter(
                (feature) =>
                  feature.get(
                    "featureType"
                  ) === "Poi"
              ).length || 0,
          routes:
            transitRouteLineSourceRef.current
              ?.getFeatures()
              ?.filter(
                (feature) =>
                  feature.get(
                    "featureType"
                  ) ===
                  "TransitRouteLine"
              ).length || 0,
        }}
        onToggleTheme={
          toggleThematicTheme
        }
        onClearAll={
          clearAllThematicLayers
        }
        onClose={() =>
          setThematicMapPanelOpen(
            false
          )
        }
      />

      {transitJourneyPanelOpen && (
        <TransitJourneyPanel
          startPoint={
            transitJourneyStartPoint
          }
          endPoint={
            transitJourneyEndPoint
          }
          selectionMode={
            transitJourneySelectionMode
          }
          poiOptions={
            journeyPoiOptions
          }
          onSelectStartPoi={(poi) =>
            selectTransitJourneyPoi(
              "start",
              poi
            )
          }
          onSelectEndPoi={(poi) =>
            selectTransitJourneyPoi(
              "end",
              poi
            )
          }
          onSelectStartPoint={() =>
            startTransitJourneyPointSelection(
              "start"
            )
          }
          onSelectEndPoint={() =>
            startTransitJourneyPointSelection(
              "end"
            )
          }
          onClearStartPoint={() => {
            transitJourneyStartPointRef.current =
              null;

            setTransitJourneyStartPoint(
              null
            );

            drawTransitJourneyBasePoints(
              null,
              transitJourneyEndPointRef.current
            );
          }}
          onClearEndPoint={() => {
            transitJourneyEndPointRef.current =
              null;

            setTransitJourneyEndPoint(
              null
            );

            drawTransitJourneyBasePoints(
              transitJourneyStartPointRef.current,
              null
            );
          }}
          onAlternativesChanged={() => {
            /*
             * Alternatiflerin listesi panel içinde tutulur.
             * Harita yalnızca seçilen alternatifi çizer.
             */
          }}
          onAlternativeSelected={(
            alternative
          ) =>
            drawTransitJourneyAlternative(
              alternative
            )
          }
          onClearJourney={
            clearTransitJourney
          }
          onClose={() => {
            setTransitJourneyPanelOpen(
              false
            );

            setTransitJourneySelectionMode(
              ""
            );

            transitJourneySelectionModeRef.current =
              "";
          }}
        />
      )}

      {queryPanelOpen && (
        <QueryPanel
          onSelectGeometry={focusGeometryFromQuery}
        />
      )}



{locationAnalysisOpen && (
  <LocationAnalysisPanel
    onClose={closeLocationAnalysis}
    onDrawArea={startLocationAnalysisAreaDraw}
    onStartAnalysis={runLocationAnalysis}
    onResetAnalysis={resetLocationAnalysis}
    areaSelected={locationAnalysisAreaSelected}
    areaWkt={locationAnalysisAreaWkt}
    categories={poiCategories}
  />
)}
{locationAnalysisRunning && (
  <div
    style={{
      position: "absolute",
      right: 20,
      bottom: 24,
      zIndex: 3500,
      width: 260,
      padding: 14,
      borderRadius: 14,
      color: "#ffffff",
      background: "rgba(7,18,42,0.95)",
      border: "1px solid rgba(96,165,250,0.28)",
      boxShadow: "0 14px 38px rgba(2,6,23,0.42)",
      backdropFilter: "blur(14px)",
    }}
  >
    <div style={{ fontWeight: 900, marginBottom: 4 }}>Konum Analizi</div>
    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 10 }}>
      {locationAnalysisPoiCount} POI değerlendirildi
    </div>
    <div
      style={{
        height: 12,
        borderRadius: 999,
        background:
          "linear-gradient(90deg,#2563eb,#06b6d4,#22c55e,#facc15,#f97316,#dc2626)",
      }}
    />
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 6,
        color: "#cbd5e1",
        fontSize: 11,
      }}
    >
      <span>Düşük uygunluk</span>
      <span>Yüksek uygunluk</span>
    </div>
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <button
        type="button"
        onClick={() => setLocationAnalysisOpen(true)}
        style={{
          flex: 1,
          height: 34,
          borderRadius: 8,
          border: "1px solid rgba(96,165,250,0.28)",
          background: "rgba(37,99,235,0.18)",
          color: "#bfdbfe",
          cursor: "pointer",
          fontWeight: 800,
        }}
      >
        Kriterleri Aç
      </button>
      <button
        type="button"
        onClick={resetLocationAnalysis}
        style={{
          height: 34,
          padding: "0 12px",
          borderRadius: 8,
          border: "1px solid rgba(248,113,113,0.26)",
          background: "rgba(220,38,38,0.14)",
          color: "#fecaca",
          cursor: "pointer",
          fontWeight: 800,
        }}
      >
        Temizle
      </button>
    </div>
  </div>
)}
{toastMessage && (
  <div style={styles.successToast}>
    {toastMessage}
  </div>
)}
      {isGeometryEditingOnMap && (
        <div style={styles.editModeBanner}>
          <div style={styles.editModeIcon}></div>

          <div style={styles.editModeText}>
            <div style={styles.editModeTitle}>Konum Düzenleme Aktif</div>

            <div style={styles.editModeDesc}>
              Objeyi sürükleyin ve ardından Konumu Kaydet butonuna basın.
            </div>
          </div>
        </div>
      )}

      {isGeometryEditingOnMap && (
        <div style={styles.editFloatingActions}>
          <button
            type="button"
            onClick={updateSelectedGeometry}
            style={styles.editSaveButton}
            disabled={isSaving}
          >
            {isSaving ? "Kaydediliyor..." : "Konumu Kaydet"}
          </button>

          <button
            type="button"
            onClick={cancelGeometryEdit}
            style={styles.editCancelButton}
          >
            İptal
          </button>
        </div>
      )}



      {heatmapOpen && (
        <div style={heatmapLegendStyles.container}>
          <div style={heatmapLegendStyles.header}>
            <span style={heatmapLegendStyles.icon}>🔥</span>
            <div>
              <div style={heatmapLegendStyles.title}>Isı Haritası Yoğunluğu</div>
              <div style={heatmapLegendStyles.subtitle}>
                Nokta, hat ve alan konumlarına göre 0–1 yoğunluk
              </div>
            </div>
          </div>

          <div style={heatmapLegendStyles.scaleWrapper}>
            <div style={heatmapLegendStyles.gradient} />

            <div style={heatmapLegendStyles.values}>
              <span>0</span>
              <span>0.2</span>
              <span>0.4</span>
              <span>0.6</span>
              <span>0.8</span>
              <span>1</span>
            </div>
          </div>

          <div style={heatmapLegendStyles.labels}>
            <span>Düşük yoğunluk</span>
            <span>Yüksek yoğunluk</span>
          </div>
        </div>
      )}


      {transitStopPopupOpen && (
        <div style={poiModalStyles.overlay}>
          <div style={poiModalStyles.box}>
            <div style={poiModalStyles.header}>
              <div>
                <h2 style={poiModalStyles.title}>Durak Bilgilerini Gir</h2>
              </div>

              <button
                type="button"
                onClick={cancelTransitStopPopup}
                style={poiModalStyles.closeButton}
              >
                ×
              </button>
            </div>

            <div style={poiModalStyles.grid}>
              <label style={poiModalStyles.field}>
                <span style={poiModalStyles.label}>Durak adı</span>
                <input
                  type="text"
                  value={transitStopForm.name}
                  onChange={(event) =>
                    setTransitStopForm((previous) => ({
                      ...previous,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Örnek: Oruç Reis Durağı"
                  style={poiModalStyles.input}
                />
              </label>

              <label style={poiModalStyles.field}>
                <span style={poiModalStyles.label}>Durak türü</span>
                <select
                  value={transitStopForm.stopType}
                  onChange={(event) =>
                    setTransitStopForm((previous) => ({
                      ...previous,
                      stopType: event.target.value,
                    }))
                  }
                  style={poiModalStyles.input}
                >
                  <option value="Bus">Otobüs Durağı</option>
                  <option value="Metro">Metro Durağı</option>
                </select>
              </label>

              <label style={poiModalStyles.field}>
                <span style={poiModalStyles.label}>Güzergah</span>
                <select
                  value={transitStopForm.transitRouteId}
                  onChange={(event) =>
                    setTransitStopForm((previous) => ({
                      ...previous,
                      transitRouteId: event.target.value,
                    }))
                  }
                  style={poiModalStyles.input}
                >
                  <option value="">Güzergah seç</option>
                  {transitRoutes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={poiModalStyles.actions}>
              <button
                type="button"
                onClick={cancelTransitStopPopup}
                style={poiModalStyles.cancelButton}
                disabled={isSavingTransitStop}
              >
                İptal
              </button>

              <button
                type="button"
                onClick={saveTransitStop}
                style={poiModalStyles.saveButton}
                disabled={isSavingTransitStop}
              >
                {isSavingTransitStop ? "Kaydediliyor..." : "Durağı Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {vehicleInfoOpen && selectedVehicle && (() => {
        const routeStops = Array.isArray(selectedVehicle.routeStops)
          ? selectedVehicle.routeStops
          : [];
        const currentProgress = Math.max(
          0,
          Math.min(100, Number(selectedVehicle.progress || 0))
        );
        const stopSegment = getVehicleStopSegment(selectedVehicle);
        const backendDistanceToNextStop = Number(
          selectedVehicle.distanceToNextStopMeters
        );
        const calculatedDistanceToNextStop = getDistanceToNextStop(
          selectedVehicle,
          stopSegment
        );
        const distanceToNextStop = Number.isFinite(backendDistanceToNextStop)
          ? backendDistanceToNextStop
          : calculatedDistanceToNextStop;
        const formattedDistanceToNextStop = formatTransitDistance(
          distanceToNextStop
        );
        const formattedEta = formatVehicleEta(
          selectedVehicle.estimatedArrivalSeconds
        );
        const currentSpeedKmh = Number.isFinite(
          Number(selectedVehicle.currentSpeedKmh)
        )
          ? Math.max(0, Number(selectedVehicle.currentSpeedKmh))
          : 0;
        const maxSpeedKmh = Number.isFinite(
          Number(selectedVehicle.maxSpeedKmh)
        )
          ? Math.max(0, Number(selectedVehicle.maxSpeedKmh))
          : 0;
        const vehicleStatusLabel = getVehicleStatusLabel(
          selectedVehicle.status,
          selectedVehicle.isRunning
        );
        const previousStopName =
          selectedVehicle.previousStopName ||
          stopSegment.previousStop?.name ||
          "Başlangıç";
        const nextStopName =
          selectedVehicle.nextStopName ||
          stopSegment.nextStop?.name ||
          "";
        const routeColor = selectedVehicle.routeColor || "#2563eb";
        const isMetro =
          String(selectedVehicle.vehicleType || "Bus").toLowerCase() ===
          "metro";
        const isWaitingAtStop =
          selectedVehicle.isWaitingAtStop === true ||
          String(selectedVehicle.status || "").toLowerCase() ===
            "waitingatstop";
        const remainingWaitSeconds = Math.max(
          0,
          Number(selectedVehicle.remainingStopWaitSeconds || 0)
        );
        const statusColor = isWaitingAtStop
          ? "#fbbf24"
          : selectedVehicle.isRunning
            ? "#34d399"
            : "#94a3b8";
        const currentStopName =
          selectedVehicle.waitingStopName ||
          selectedVehicle.currentStopName ||
          nextStopName ||
          previousStopName;

        const metricCardStyle = {
          padding: "12px",
          borderRadius: 14,
          minWidth: 0,
          background: "rgba(15, 39, 69, 0.72)",
          border: "1px solid rgba(148, 197, 255, 0.12)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.025)",
        };

        const metricLabelStyle = {
          color: "#8fb3d9",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.065em",
          textTransform: "uppercase",
          marginBottom: 5,
        };

        const metricValueStyle = {
          color: "#f8fafc",
          fontSize: 14,
          lineHeight: 1.2,
          fontWeight: 850,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        };

        return (
          <div style={poiModalStyles.infoFloatingLayer}>
            <div
              className="poi-info-slide-card"
              style={{
                ...poiModalStyles.infoWhiteCard,
                width: 380,
                maxWidth: "calc(100vw - 28px)",
                maxHeight: "calc(100vh - 118px)",
                overflowY: "auto",
                overflowX: "hidden",
                padding: 0,
                color: "#f8fafc",
                background:
                  "linear-gradient(160deg, rgba(4,20,40,0.995) 0%, rgba(7,34,64,0.99) 58%, rgba(4,23,45,0.995) 100%)",
                border: `1px solid ${routeColor}88`,
                borderTop: `4px solid ${routeColor}`,
                borderRadius: 14,
                boxShadow:
                  "0 28px 80px rgba(2, 10, 24, 0.58), 0 0 0 1px rgba(255,255,255,0.025)",
              }}
            >
              <div
                style={{
                  position: "relative",
                  padding: "13px 14px 11px",
                  background: `linear-gradient(135deg, ${routeColor}2b, rgba(255,255,255,0.015) 68%)`,
                  borderBottom: "1px solid rgba(148,197,255,0.10)",
                }}
              >
                <button
                  type="button"
                  aria-label="Araç bilgi penceresini kapat"
                  onClick={closeVehicleInfo}
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    width: 34,
                    height: 34,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 11,
                    border: "1px solid rgba(191,219,254,0.18)",
                    background: "rgba(3,15,31,0.48)",
                    color: "#dbeafe",
                    fontSize: 22,
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    paddingRight: 38,
                  }}
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      flex: "0 0 auto",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.96)",
                      border: `3px solid ${routeColor}`,
                      boxShadow: `0 10px 28px ${routeColor}36`,
                    }}
                  >
                    <img
                      src={createVehicleIconDataUri(
                        selectedVehicle.vehicleType,
                        routeColor
                      )}
                      alt={isMetro ? "Metro" : "Otobüs"}
                      style={{ width: 27, height: 27, objectFit: "contain" }}
                    />
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 7,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          minHeight: 24,
                          padding: "3px 9px",
                          borderRadius: 999,
                          background: routeColor,
                          color: "#ffffff",
                          fontSize: 11,
                          fontWeight: 900,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {selectedVehicle.shortCode || (isMetro ? "METRO" : "OTOBÜS")}
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          minHeight: 24,
                          padding: "3px 9px",
                          borderRadius: 999,
                          background: `${statusColor}18`,
                          border: `1px solid ${statusColor}55`,
                          color: statusColor,
                          fontSize: 11,
                          fontWeight: 850,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: statusColor,
                            boxShadow: `0 0 9px ${statusColor}`,
                          }}
                        />
                        {vehicleStatusLabel}
                      </span>
                    </div>

                    <h2
                      title={selectedVehicle.routeName}
                      style={{
                        margin: 0,
                        color: "#ffffff",
                        fontSize: 17,
                        lineHeight: 1.2,
                        fontWeight: 900,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {selectedVehicle.routeName || "Toplu Taşıma Aracı"}
                    </h2>
                    <div
                      style={{
                        marginTop: 5,
                        color: "#9fb9d4",
                        fontSize: 12,
                        fontWeight: 650,
                      }}
                    >
                      {isMetro ? "Metro aracı" : "Otobüs aracı"}
                      {selectedVehicle.vehicleCode
                        ? ` · ${selectedVehicle.vehicleCode}`
                        : ""}
                      {selectedVehicle.tripCode
                        ? ` · Sefer ${selectedVehicle.tripCode}`
                        : ""}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: "11px 12px 12px" }}>
                {isWaitingAtStop && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 10,
                      padding: "12px 13px",
                      borderRadius: 14,
                      background: "rgba(245,158,11,0.11)",
                      border: "1px solid rgba(251,191,36,0.34)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          color: "#fbbf24",
                          fontSize: 10,
                          fontWeight: 900,
                          letterSpacing: "0.08em",
                          marginBottom: 4,
                        }}
                      >
                        DURAKTA BEKLİYOR
                      </div>
                      <div
                        style={{
                          color: "#ffffff",
                          fontSize: 13,
                          fontWeight: 850,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {currentStopName}
                      </div>
                    </div>
                    <div
                      style={{
                        flex: "0 0 auto",
                        minWidth: 62,
                        padding: "8px 10px",
                        borderRadius: 11,
                        background: "rgba(3,18,38,0.58)",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          color: "#fef3c7",
                          fontSize: 18,
                          fontWeight: 950,
                          lineHeight: 1,
                        }}
                      >
                        {Math.ceil(remainingWaitSeconds)} sn
                      </div>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 9,
                    marginBottom: 10,
                  }}
                >
                  <div style={metricCardStyle}>
                    <div style={metricLabelStyle}>Anlık hız</div>
                    <div style={metricValueStyle}>
                      {currentSpeedKmh.toFixed(1)} km/sa
                    </div>
                  </div>
                  <div style={metricCardStyle}>
                    <div style={metricLabelStyle}>Maksimum</div>
                    <div style={metricValueStyle}>
                      {maxSpeedKmh > 0 ? `${maxSpeedKmh.toFixed(0)} km/sa` : "-"}
                    </div>
                  </div>
                  <div style={metricCardStyle}>
                    <div style={metricLabelStyle}>İlerleme</div>
                    <div style={metricValueStyle}>
                      %{currentProgress.toFixed(1)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginBottom: 10,
                    padding: "11px 12px",
                    borderRadius: 14,
                    background: "rgba(9,31,57,0.78)",
                    border: "1px solid rgba(148,197,255,0.12)",
                  }}
                >
                  <div
                    style={{
                      color: "#78aee8",
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: "0.085em",
                      marginBottom: 12,
                    }}
                  >
                    DURAK BİLGİSİ
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px minmax(0, 1fr)",
                      columnGap: 10,
                      rowGap: 2,
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <span
                        style={{
                          position: "relative",
                          zIndex: 2,
                          width: 12,
                          height: 12,
                          marginTop: 3,
                          borderRadius: "50%",
                          background: routeColor,
                          border: "3px solid #dbeafe",
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          top: 16,
                          bottom: -19,
                          width: 2,
                          background: `${routeColor}88`,
                        }}
                      />
                    </div>
                    <div style={{ paddingBottom: 16, minWidth: 0 }}>
                      <div style={{ color: "#8fb3d9", fontSize: 10, fontWeight: 800 }}>
                        Önceki durak
                      </div>
                      <div
                        title={previousStopName}
                        style={{
                          marginTop: 3,
                          color: "#ffffff",
                          fontSize: 13,
                          fontWeight: 850,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {previousStopName}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          marginTop: 3,
                          borderRadius: "4px",
                          background: nextStopName ? "#ffffff" : "#34d399",
                          border: `3px solid ${nextStopName ? routeColor : "#34d399"}`,
                          boxShadow: nextStopName ? `0 0 10px ${routeColor}66` : "none",
                        }}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "#8fb3d9", fontSize: 10, fontWeight: 800 }}>
                        {nextStopName ? "Sonraki durak" : "Varış"}
                      </div>
                      <div
                        title={nextStopName || previousStopName}
                        style={{
                          marginTop: 3,
                          color: "#ffffff",
                          fontSize: 13,
                          fontWeight: 850,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {nextStopName || "Son durağa ulaşıldı"}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 9,
                      marginTop: 14,
                    }}
                  >
                    <div style={metricCardStyle}>
                      <div style={metricLabelStyle}>Kalan mesafe</div>
                      <div style={metricValueStyle}>
                        {nextStopName
                          ? formattedDistanceToNextStop || "Hesaplanıyor"
                          : "0 m"}
                      </div>
                    </div>
                    <div style={metricCardStyle}>
                      <div style={metricLabelStyle}>Tahmini varış</div>
                      <div style={metricValueStyle}>
                        {nextStopName ? formattedEta || "Hesaplanıyor" : "Ulaşıldı"}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginBottom: 10,
                    padding: "11px 12px",
                    borderRadius: 14,
                    background: "rgba(9,31,57,0.78)",
                    border: "1px solid rgba(148,197,255,0.12)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 9,
                    }}
                  >
                    <div
                      style={{
                        color: "#78aee8",
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: "0.075em",
                      }}
                    >
                      GÜZERGÂH İLERLEMESİ
                    </div>
                    <div style={{ color: "#dbeafe", fontSize: 10, fontWeight: 850 }}>
                      %{currentProgress.toFixed(1)} · {routeStops.length} durak
                    </div>
                  </div>

                  {routeStops.length > 0 ? (
                    <div
                      style={{
                        maxHeight: 188,
                        overflowY: "auto",
                        overflowX: "hidden",
                        paddingRight: 4,
                      }}
                    >
                      {routeStops.map((stop, index) => {
                        const stopPosition = Math.max(
                          0,
                          Math.min(100, Number(stop.positionPercent ?? 0))
                        );
                        const isPassed = currentProgress >= stopPosition;
                        const isPrevious =
                          stopSegment.previousStop?.id === stop.id;
                        const isNext = stopSegment.nextStop?.id === stop.id;
                        const isActive = isPrevious || isNext;

                        return (
                          <div
                            key={stop.id ?? index}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "20px minmax(0,1fr) auto",
                              alignItems: "center",
                              columnGap: 8,
                              minHeight: 31,
                              position: "relative",
                            }}
                          >
                            <div
                              style={{
                                position: "relative",
                                height: "100%",
                                display: "grid",
                                placeItems: "center",
                              }}
                            >
                              {index > 0 && (
                                <span
                                  style={{
                                    position: "absolute",
                                    top: 0,
                                    bottom: "50%",
                                    width: 2,
                                    background: isPassed
                                      ? routeColor
                                      : "rgba(148,163,184,0.28)",
                                  }}
                                />
                              )}
                              {index < routeStops.length - 1 && (
                                <span
                                  style={{
                                    position: "absolute",
                                    top: "50%",
                                    bottom: 0,
                                    width: 2,
                                    background:
                                      currentProgress > stopPosition
                                        ? routeColor
                                        : "rgba(148,163,184,0.28)",
                                  }}
                                />
                              )}
                              <span
                                style={{
                                  position: "relative",
                                  zIndex: 2,
                                  width: isActive ? 13 : 10,
                                  height: isActive ? 13 : 10,
                                  borderRadius: "50%",
                                  background: isPassed ? routeColor : "#082744",
                                  border: `2px solid ${isActive ? "#ffffff" : routeColor}`,
                                  boxShadow: isActive
                                    ? `0 0 0 3px ${routeColor}45`
                                    : "none",
                                }}
                              />
                            </div>

                            <div
                              title={stop.name}
                              style={{
                                minWidth: 0,
                                color: isActive ? "#ffffff" : isPassed ? "#dbeafe" : "#9fb9d4",
                                fontSize: 11,
                                lineHeight: 1.2,
                                fontWeight: isActive ? 850 : 680,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {stop.name}
                            </div>

                            <div
                              style={{
                                color: isActive ? routeColor : "#7893ad",
                                fontSize: 9,
                                fontWeight: 850,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isPrevious
                                ? "ARAÇ"
                                : isNext
                                  ? "SONRAKİ"
                                  : isPassed
                                    ? "GEÇİLDİ"
                                    : `%${stopPosition.toFixed(0)}`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ color: "#9fb9d4", fontSize: 11 }}>
                      Durak bilgisi bulunamadı.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={
                    followingVehicleSimulationId === selectedVehicle.simulationId
                      ? stopFollowingVehicle
                      : startFollowingVehicle
                  }
                  style={{
                    width: "100%",
                    minHeight: 39,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius: 14,
                    cursor: "pointer",
                    color: "#ffffff",
                    fontSize: 12,
                    fontWeight: 900,
                    border: `1px solid ${routeColor}`,
                    background:
                      followingVehicleSimulationId === selectedVehicle.simulationId
                        ? "rgba(15, 39, 69, 0.90)"
                        : `linear-gradient(135deg, ${routeColor}, ${routeColor}cc)`,
                    boxShadow:
                      followingVehicleSimulationId === selectedVehicle.simulationId
                        ? "none"
                        : `0 12px 26px ${routeColor}38`,
                  }}
                >
                  <span style={{ fontSize: 16 }}>
                    {followingVehicleSimulationId === selectedVehicle.simulationId ? "■" : "◎"}
                  </span>
                  {followingVehicleSimulationId === selectedVehicle.simulationId
                    ? "Araç Takibini Bırak"
                    : "Aracı Haritada Takip Et"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {transitStopInfoOpen && selectedTransitStop && (
        <div style={poiModalStyles.infoFloatingLayer}>
          <div
            className="poi-info-slide-card"
            style={{
              ...poiModalStyles.infoWhiteCard,
              width: 390,
              background:
                "linear-gradient(145deg, rgba(7,18,42,0.99), rgba(15,42,86,0.98))",
              borderColor:
                selectedTransitStop.routeColor || "#2563eb",
            }}
          >
            <div style={poiModalStyles.infoWhiteTopActions}>
              <button
                type="button"
                aria-label="Durak bilgi penceresini kapat"
                onClick={() => {
                  setTransitStopInfoOpen(false);
                  setSelectedTransitStop(null);
                }}
                style={{
                  ...poiModalStyles.infoWhiteCloseButton,
                  color: "#dbeafe",
                  borderColor: "rgba(147,197,253,0.35)",
                  background: "rgba(255,255,255,0.08)",
                }}
              >
                ×
              </button>
            </div>

            <div style={poiModalStyles.infoWhiteContent}>
              <div
                style={{
                  ...poiModalStyles.transitRouteBadge,
                  borderColor:
                    selectedTransitStop.routeColor || "#2563eb",
                  background: `${selectedTransitStop.routeColor || "#2563eb"}22`,
                }}
              >
                <strong style={poiModalStyles.transitRouteCode}>
                  {selectedTransitStop.routeShortCode ||
                    (selectedTransitStop.stopType === "Metro"
                      ? "M"
                      : "O")}
                </strong>

                <span style={poiModalStyles.transitRouteBadgeDivider} />

                <span style={poiModalStyles.transitRouteName}>
                  {selectedTransitStop.routeName ||
                    "Güzergah belirtilmedi"}
                </span>
              </div>

              <h2 style={poiModalStyles.transitStopTitle}>
                {String(
                  selectedTransitStop.name || "İsimsiz Durak"
                ).toLocaleUpperCase("tr-TR")}
              </h2>

              <div style={poiModalStyles.transitStopsSection}>
                <div style={poiModalStyles.transitStopsHeader}>
                  <span style={poiModalStyles.transitStopsTitle}>
                    Güzergah Durakları
                  </span>

                  <span style={poiModalStyles.transitStopsCount}>
                    {selectedTransitStop.routeStops?.length || 0} durak
                  </span>
                </div>

                <div style={poiModalStyles.transitStopsList}>
                  {(selectedTransitStop.routeStops || []).map(
                    (routeStop) => {
                      const isSelected =
                        String(routeStop.id) ===
                        String(selectedTransitStop.id);

                      return (
                        <div
                          key={routeStop.id}
                          style={{
                            ...poiModalStyles.transitStopListItem,
                            ...(isSelected
                              ? poiModalStyles.transitStopListItemActive
                              : {}),
                            ...(isSelected
                              ? {
                                  borderColor:
                                    selectedTransitStop.routeColor ||
                                    "#2563eb",
                                  background: `${
                                    selectedTransitStop.routeColor ||
                                    "#2563eb"
                                  }2b`,
                                }
                              : {}),
                          }}
                        >
                          <span
                            style={{
                              ...poiModalStyles.transitStopOrderBadge,
                              ...(isSelected
                                ? {
                                    background:
                                      selectedTransitStop.routeColor ||
                                      "#2563eb",
                                    color: "#ffffff",
                                  }
                                : {}),
                            }}
                          >
                            {routeStop.orderNo}
                          </span>

                          <span
                            style={{
                              ...poiModalStyles.transitStopListName,
                              ...(isSelected
                                ? poiModalStyles.transitStopListNameActive
                                : {}),
                            }}
                          >
                            {routeStop.name}
                          </span>

                          
                          
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {poiPopupOpen && (
        <div style={poiModalStyles.overlay}>
          <div style={poiModalStyles.box}>
            <div style={poiModalStyles.header}>
              <div>
                <h2 style={poiModalStyles.title}>POI Bilgilerini Gir</h2>
              </div>

              <button
                type="button"
                onClick={cancelPoiPopup}
                style={poiModalStyles.closeButton}
              >
                ×
              </button>
            </div>

            <div style={poiModalStyles.grid}>
              <label style={poiModalStyles.field}>
                <span style={poiModalStyles.label}>POI adı</span>
                <input
                  type="text"
                  value={poiForm.name}
                  onChange={(event) =>
                    setPoiForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  style={poiModalStyles.input}
                />
              </label>

              <label style={poiModalStyles.field}>
                <span style={poiModalStyles.label}>Ana kategori</span>
                <select
                  value={poiForm.parentCategoryId}
                  onChange={(event) =>
                    setPoiForm((prev) => ({
                      ...prev,
                      parentCategoryId: event.target.value,
                      poiCategoryId: "",
                    }))
                  }
                  style={poiModalStyles.input}
                >
                  <option value="">Ana kategori seç</option>
                  {poiCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={poiModalStyles.field}>
                <span style={poiModalStyles.label}>Alt kategori</span>
                <select
                  value={poiForm.poiCategoryId}
                  onChange={(event) =>
                    setPoiForm((prev) => ({
                      ...prev,
                      poiCategoryId: event.target.value,
                    }))
                  }
                  style={poiModalStyles.input}
                  disabled={!poiForm.parentCategoryId}
                >
                  <option value="">Alt kategori seç</option>
                  {(
                    poiCategories.find(
                      (category) =>
                        String(category.id) ===
                        String(poiForm.parentCategoryId)
                    )?.children || []
                  ).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={poiModalStyles.field}>
                <span style={poiModalStyles.label}>Açılış saati</span>
                <input
                  type="time"
                  value={poiForm.openingTime}
                  onChange={(event) =>
                    setPoiForm((prev) => ({
                      ...prev,
                      openingTime: event.target.value,
                    }))
                  }
                  style={poiModalStyles.input}
                />
              </label>

              <label style={poiModalStyles.field}>
                <span style={poiModalStyles.label}>Kapanış saati</span>
                <input
                  type="time"
                  value={poiForm.closingTime}
                  onChange={(event) =>
                    setPoiForm((prev) => ({
                      ...prev,
                      closingTime: event.target.value,
                    }))
                  }
                  style={poiModalStyles.input}
                />
              </label>
            </div>

            <div style={poiModalStyles.actions}>
              <button
                type="button"
                onClick={cancelPoiPopup}
                style={poiModalStyles.cancelButton}
                disabled={isSavingPoi}
              >
                İptal
              </button>

              <button
                type="button"
                onClick={savePoi}
                style={poiModalStyles.saveButton}
                disabled={isSavingPoi}
              >
                {isSavingPoi ? "Kaydediliyor..." : "POI Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {poiInfoOpen && selectedPoi && (
        <div style={poiModalStyles.infoFloatingLayer}>
          <div
            className="poi-info-slide-card"
            style={{
              ...poiModalStyles.infoWhiteCard,
              background: selectedPoiTheme.cardBackground,
              borderColor: selectedPoiTheme.borderColor,
            }}
          >
            <div style={poiModalStyles.infoWhiteTopActions}>
              <button
                type="button"
                aria-label="Ek bilgileri göster"
                title="Ek bilgileri göster"
                onClick={() =>
                  setPoiInfoDetailsOpen((currentValue) => !currentValue)
                }
                style={{
                  ...poiModalStyles.infoWhiteButton,
                  color: selectedPoiTheme.badgeText,
                  borderColor: selectedPoiTheme.badgeBorder,
                  background: poiInfoDetailsOpen
                    ? selectedPoiTheme.accentColor
                    : selectedPoiTheme.badgeBackground,
                  ...(poiInfoDetailsOpen
                    ? poiModalStyles.infoWhiteButtonActive
                    : {}),
                }}
              >
                i
              </button>

              <button
                type="button"
                aria-label="POI bilgi penceresini kapat"
                onClick={() => {
                  setPoiInfoOpen(false);
                  setPoiInfoDetailsOpen(false);
                  setSelectedPoi(null);
                }}
                style={{
                  ...poiModalStyles.infoWhiteCloseButton,
                  color: selectedPoiTheme.badgeText,
                  borderColor: selectedPoiTheme.badgeBorder,
                  background: "rgba(255,255,255,0.08)",
                }}
              >
                ×
              </button>
            </div>

            <div style={poiModalStyles.infoWhiteContent}>
              <div style={{
                  ...poiModalStyles.infoWhiteCategory,
                  background: selectedPoiTheme.badgeBackground,
                  borderColor: selectedPoiTheme.badgeBorder,
                }}>
                <span style={{
                    ...poiModalStyles.infoWhiteCategoryIcon,
                    background: selectedPoiTheme.iconBackground,
                    borderColor: selectedPoiTheme.iconBorder,
                  }}>
                  {getPoiCategoryIcon(selectedPoi.parentCategoryName)}
                </span>

                <span style={{
                    ...poiModalStyles.infoWhiteCategoryText,
                    color: selectedPoiTheme.badgeText,
                  }}>
                  {selectedPoi.categoryName || "Kategori belirtilmedi"}
                </span>
              </div>

              <h2 style={{
                  ...poiModalStyles.infoWhiteName,
                  color: selectedPoiTheme.titleColor,
                }}>
                {selectedPoi.name || "İsimsiz POI"}
              </h2>

              <div style={poiModalStyles.infoWhiteHoursBlock}>
                <span style={{
                    ...poiModalStyles.infoWhiteHoursCaption,
                    color: selectedPoiTheme.mutedColor,
                  }}>
                  Çalışma saatleri
                </span>

                <strong style={{
                  ...poiModalStyles.infoWhiteHoursValue,
                  color: selectedPoiTheme.hourColor,
                }}>
                  {String(selectedPoi.openingTime || "-").slice(0, 5)}
                  <span style={{
                    ...poiModalStyles.infoWhiteHoursDash,
                    color: selectedPoiTheme.accentColor,
                  }}>—</span>
                  {String(selectedPoi.closingTime || "-").slice(0, 5)}
                </strong>
              </div>

              {poiInfoDetailsOpen && (
                <div style={{
                  ...poiModalStyles.infoWhiteDetails,
                  borderTopColor: selectedPoiTheme.detailBorder,
                }}>
                  <div style={poiModalStyles.infoWhiteDetailRow}>
                    <span style={{
                      ...poiModalStyles.infoWhiteDetailLabel,
                      color: selectedPoiTheme.detailLabel,
                    }}>
                      Ekleyen
                    </span>
                    <strong style={{
                      ...poiModalStyles.infoWhiteDetailValue,
                      color: selectedPoiTheme.detailValue,
                    }}>
                      {selectedPoi.username || "-"}
                    </strong>
                  </div>

                  <div style={poiModalStyles.infoWhiteDetailRow}>
                    <span style={{
                      ...poiModalStyles.infoWhiteDetailLabel,
                      color: selectedPoiTheme.detailLabel,
                    }}>
                      Eklenme tarihi
                    </span>
                    <strong style={{
                      ...poiModalStyles.infoWhiteDetailValue,
                      color: selectedPoiTheme.detailValue,
                    }}>
                      {formatPoiCreatedDate(selectedPoi.createdDate)}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setPoiInfoOpen(false);
                setPoiInfoDetailsOpen(false);
                setSelectedPoi(null);
              }}
              style={{
                ...poiModalStyles.infoWhiteDoneButton,
                background: selectedPoiTheme.buttonBackground,
                borderColor: selectedPoiTheme.buttonBorder,
              }}
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      <GeometryPopup
        styles={styles}
        popupOpen={popupOpen}
        pendingData={pendingData}
        form={form}
        setForm={setForm}
        saveSuccess={saveSuccess}
        isSaving={isSaving}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        inventoryCount={inventoryCount}
        analysisResult={analysisResult}
        closePopup={closePopup}
        saveGeometry={saveGeometry}
        updateSelectedGeometry={updateSelectedGeometry}
        deleteSelectedGeometry={deleteSelectedGeometry}
        deleteInventoryArea={deleteInventoryArea}
        getGeometryName={() => getGeometryName(pendingData)}
        getInfoTitle={() => getInfoTitle(pendingData)}
        startGeometryEdit={startGeometryEdit}
        isGeometryEditingOnMap={isGeometryEditingOnMap}
      />

      {overlapModalOpen && (
        <div style={styles.confirmOverlay}>
          <div style={styles.confirmBox}>
            <p style={styles.overlapTitle}>Açmak istediğiniz çizimi seçin.</p>

            <div style={styles.overlapList}>
              {overlapFeatures.map((feature, index) => {
                const featureType = feature.get("featureType");

                const typeNames = {
                  Point: "Point",
                  LineString: "Line",
                  Polygon: "Polygon",
                  Poi: "POI",
                  TransitStop: "Durak",
                };

                const type = typeNames[featureType] || featureType;
                const name = feature.get("name") || `${type} ${index + 1}`;

                return (
                  <button
                    key={`${featureType}-${feature.get("id") ?? index}`}
                    type="button"
                    onClick={() => {
                      if (featureType === "TransitStop") {
                        openTransitStopInfo(feature);
                        return;
                      }

                      if (featureType === "Poi") {
                        openPoiInfo(feature);
                        return;
                      }

                      openFeatureInfo(feature);
                    }}
                    style={styles.overlapItem}
                  >
                    <span>{type}</span>
                    <strong>{name}</strong>
                  </button>
                );
              })}
            </div>

            <div style={styles.overlapCloseWrapper}>
              <button
                type="button"
                onClick={() => {
                  setOverlapModalOpen(false);
                  setOverlapFeatures([]);
                }}
                style={styles.overlapCloseButton}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
{regionWarningOpen && (
  <div style={regionModalStyles.overlay}>
    <div style={regionModalStyles.box}>
      <div style={regionModalStyles.icon}>🔒</div>

      <h2 style={regionModalStyles.title}>Erişim Yok</h2>

      <p style={regionModalStyles.text}>
        Bu yetki alanı dışında çizim yapamazsınız.
      </p>

      <button
        type="button"
        onClick={() => setRegionWarningOpen(false)}
        style={regionModalStyles.button}
      >
        Tamam
      </button>
    </div>
  </div>
)}
      {deleteConfirmOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999999,
          }}
        >
          <div
            style={{
              width: 360,
              background: "#1e293b",
              color: "white",
              padding: 24,
              borderRadius: 16,
            }}
          >
            <h2 style={styles.confirmTitle}>Çizimi Sil</h2>

            <p style={styles.confirmText}>
              Bu çizimi silmek istediğine emin misin?
            </p>

            <div style={styles.confirmButtons}>
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                style={styles.confirmCancel}
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={confirmDeleteGeometry}
                style={styles.confirmDelete}
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const poiModalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 999999,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
    background: "rgba(2,6,23,0.70)",
    backdropFilter: "blur(6px)",
  },
  box: {
    width: "min(430px, 100%)",
    maxHeight: "calc(100vh - 36px)",
    overflowY: "auto",
    padding: "22px 24px 20px",
    borderRadius: 14,
    color: "#ffffff",
    background: "rgba(7,18,42,0.98)",
    border: "1px solid rgba(96,165,250,0.13)",
    boxShadow: "0 18px 46px rgba(2,6,23,0.40)",
  },
  infoBox: {
    width: "min(560px, 100%)",
    padding: 24,
    borderRadius: 22,
    color: "#ffffff",
    background: "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
    border: "1px solid rgba(96,165,250,0.40)",
    boxShadow: "0 28px 80px rgba(37,99,235,0.34)",
  },
  infoFloatingLayer: {
    position: "fixed",
    top: 70,
    left: 16,
    zIndex: 999999,
    pointerEvents: "none",
  },

  infoWhiteCard: {
    position: "relative",
    width: 340,
    padding: "20px 20px 17px",
    borderRadius: 15,
    color: "#ffffff",
    border: "1px solid rgba(96,165,250,0.25)",
    boxShadow: "0 20px 54px rgba(2,6,23,0.34)",
    pointerEvents: "auto",
    animation: "poiInfoSlideIn 190ms cubic-bezier(0.22, 1, 0.36, 1) both",
    willChange: "transform, opacity",
    overflow: "hidden",
  },

  infoWhiteTopActions: {
    position: "absolute",
    top: 12,
    right: 12,
    display: "flex",
    alignItems: "center",
    gap: 7,
  },

  infoWhiteButton: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.20)",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    fontFamily: "Georgia, serif",
    fontSize: 16,
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  infoWhiteButtonActive: {
    color: "#ffffff",
    boxShadow: "0 6px 16px rgba(2,6,23,0.22)",
  },

  infoWhiteCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
  },

  infoWhiteContent: {
    padding: "3px 44px 0 0",
    textAlign: "left",
  },

  infoWhiteCategory: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    minHeight: 28,
    padding: "5px 10px 5px 7px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.1px",
  },

  infoWhiteCategoryIcon: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 13,
    lineHeight: 1,
    flexShrink: 0,
  },

  infoWhiteCategoryText: {
    fontSize: 12,
    fontWeight: 850,
    lineHeight: 1,
  },

  infoWhiteName: {
    margin: "13px 0 0",
    color: "#ffffff",
    fontSize: 27,
    lineHeight: 1.14,
    fontWeight: 900,
    letterSpacing: "-0.5px",
    wordBreak: "break-word",
  },

  infoWhiteHoursBlock: {
    marginTop: 20,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 6,
  },

  infoWhiteHoursCaption: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "1.05px",
  },

  infoWhiteHoursValue: {
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: "-0.6px",
  },

  infoWhiteHoursDash: {
    display: "inline-block",
    margin: "0 8px",
    color: "#2563eb",
    fontWeight: 700,
  },

  transitRouteBadge: {
    display: "inline-flex",
    alignItems: "center",
    maxWidth: "calc(100% - 4px)",
    minHeight: 32,
    padding: "5px 11px",
    borderRadius: 999,
    border: "1px solid rgba(147,197,253,0.28)",
    color: "#dbeafe",
  },

  transitRouteCode: {
    flexShrink: 0,
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: "0.4px",
  },

  transitRouteBadgeDivider: {
    width: 1,
    height: 15,
    margin: "0 9px",
    background: "rgba(255,255,255,0.24)",
    flexShrink: 0,
  },

  transitRouteName: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 800,
  },

  transitStopTitle: {
    margin: "17px 0 0",
    color: "#ffffff",
    fontSize: 27,
    lineHeight: 1.12,
    fontWeight: 900,
    letterSpacing: "-0.45px",
    wordBreak: "break-word",
  },

  transitStopsSection: {
    marginTop: 22,
    paddingTop: 16,
    borderTop: "1px solid rgba(148,163,184,0.18)",
  },

  transitStopsHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },

  transitStopsTitle: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },

  transitStopsCount: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 800,
  },

  transitStopsList: {
    maxHeight: 250,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 7,
    paddingRight: 3,
  },

  transitStopListItem: {
    minHeight: 40,
    padding: "7px 9px",
    borderRadius: 9,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,23,42,0.42)",
    display: "flex",
    alignItems: "center",
    gap: 9,
  },

  transitStopListItemActive: {
    boxShadow: "inset 3px 0 0 rgba(255,255,255,0.24)",
  },

  transitStopOrderBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    background: "rgba(51,65,85,0.86)",
    color: "#94a3b8",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: 10,
    fontWeight: 900,
  },

  transitStopListName: {
    minWidth: 0,
    flex: 1,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 750,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  transitStopListNameActive: {
    color: "#ffffff",
    fontWeight: 900,
  },



  infoWhiteDetails: {
    marginTop: 20,
    paddingTop: 14,
    borderTop: "1px solid rgba(255,255,255,0.14)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  infoWhiteDetailRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },

  infoWhiteDetailLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 800,
  },

  infoWhiteDetailValue: {
    color: "#334155",
    fontSize: 12,
    fontWeight: 800,
    textAlign: "right",
  },

  infoWhiteDoneButton: {
    width: "100%",
    height: 38,
    marginTop: 20,
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 9,
    cursor: "pointer",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 850,
    boxShadow: "none",
  },

  elegantInfoBox: {
    position: "relative",
    width: "min(420px, 100%)",
    padding: "22px 24px 24px",
    borderRadius: 24,
    color: "#ffffff",
    background:
      "linear-gradient(180deg, rgba(9,19,39,0.99) 0%, rgba(5,12,27,0.99) 100%)",
    border: "1px solid rgba(96,165,250,0.22)",
    boxShadow:
      "0 30px 90px rgba(2,6,23,0.62), inset 0 1px 0 rgba(255,255,255,0.025)",
  },

  elegantTopActions: {
    position: "absolute",
    top: 14,
    right: 14,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  elegantInfoButton: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "1px solid rgba(96,165,250,0.26)",
    background: "transparent",
    color: "#7dd3fc",
    fontFamily: "Georgia, serif",
    fontSize: 17,
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  elegantInfoButtonActive: {
    background: "#2563eb",
    color: "#ffffff",
    border: "1px solid rgba(147,197,253,0.72)",
    boxShadow: "0 6px 18px rgba(37,99,235,0.28)",
  },

  elegantCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "transparent",
    color: "#94a3b8",
    fontSize: 22,
    lineHeight: 1,
    cursor: "pointer",
  },

  elegantContent: {
    padding: "22px 12px 2px",
    textAlign: "center",
  },

  elegantCategoryBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    padding: "5px 11px",
    borderRadius: 999,
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(96,165,250,0.16)",
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.2px",
  },

  elegantPoiName: {
    margin: "18px 0 0",
    color: "#ffffff",
    fontSize: 32,
    lineHeight: 1.12,
    fontWeight: 900,
    letterSpacing: "-0.7px",
    wordBreak: "break-word",
  },

  elegantHoursBlock: {
    marginTop: 30,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 9,
  },

  elegantHoursCaption: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "1.25px",
  },

  elegantHoursValue: {
    color: "#ffffff",
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: "-0.8px",
  },

  elegantHoursDash: {
    display: "inline-block",
    margin: "0 11px",
    color: "#3b82f6",
    fontWeight: 600,
  },

  elegantDetails: {
    marginTop: 28,
    paddingTop: 18,
    borderTop: "1px solid rgba(148,163,184,0.12)",
    display: "flex",
    flexDirection: "column",
    gap: 13,
  },

  elegantDetailRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  },

  elegantDetailLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },

  elegantDetailValue: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 800,
    textAlign: "right",
  },

  elegantDoneButton: {
    width: "100%",
    height: 43,
    marginTop: 26,
    border: "1px solid rgba(96,165,250,0.24)",
    borderRadius: 12,
    cursor: "pointer",
    color: "#dbeafe",
    fontSize: 14,
    fontWeight: 850,
    background: "rgba(30,58,138,0.42)",
  },

  focusInfoBox: {
    position: "relative",
    width: "min(430px, 100%)",
    padding: "42px 34px 28px",
    borderRadius: 24,
    color: "#ffffff",
    textAlign: "center",
    background:
      "linear-gradient(180deg, rgba(13,24,46,0.99) 0%, rgba(7,16,34,0.99) 100%)",
    border: "1px solid rgba(96,165,250,0.28)",
    boxShadow:
      "0 30px 90px rgba(2,6,23,0.58), 0 0 0 1px rgba(255,255,255,0.02) inset",
  },

  infoToggleButton: {
    position: "absolute",
    top: 15,
    right: 58,
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "1px solid rgba(96,165,250,0.30)",
    background: "rgba(30,58,104,0.28)",
    color: "#93c5fd",
    fontFamily: "Georgia, serif",
    fontSize: 18,
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.18s ease",
  },

  infoToggleButtonActive: {
    background: "rgba(37,99,235,0.92)",
    color: "#ffffff",
    border: "1px solid rgba(147,197,253,0.72)",
    boxShadow: "0 6px 18px rgba(37,99,235,0.30)",
  },

  focusCloseButton: {
    position: "absolute",
    top: 15,
    right: 15,
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(15,23,42,0.72)",
    color: "#cbd5e1",
    fontSize: 23,
    lineHeight: 1,
    cursor: "pointer",
  },

  focusHeader: {
    padding: "4px 18px 0",
  },

  focusPoiName: {
    margin: 0,
    color: "#ffffff",
    fontSize: 31,
    lineHeight: 1.15,
    fontWeight: 900,
    letterSpacing: "-0.6px",
    wordBreak: "break-word",
  },

  focusCategoryLine: {
    marginTop: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    fontSize: 14,
  },

  focusCategoryMain: {
    color: "#bfdbfe",
    fontWeight: 850,
  },

  focusCategoryDot: {
    color: "#3b82f6",
    fontWeight: 900,
  },

  focusCategorySub: {
    color: "#94a3b8",
    fontWeight: 750,
  },

  focusHoursSection: {
    marginTop: 30,
    padding: "4px 0 6px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },

  focusHoursLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "1.2px",
  },

  focusHoursValue: {
    color: "#ffffff",
    fontSize: 31,
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: "-0.6px",
  },

  focusHoursSeparator: {
    display: "inline-block",
    margin: "0 10px",
    color: "#3b82f6",
    fontWeight: 700,
  },

  infoDetailsPanel: {
    marginTop: 26,
    padding: "16px 18px",
    borderTop: "1px solid rgba(148,163,184,0.12)",
    borderBottom: "1px solid rgba(148,163,184,0.12)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    textAlign: "left",
  },

  infoDetailRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  },

  infoDetailLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },

  infoDetailValue: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 800,
    textAlign: "right",
  },

  infoDetailLine: {
    height: 1,
    background: "rgba(148,163,184,0.08)",
  },

  focusDoneButton: {
    width: "100%",
    height: 44,
    marginTop: 28,
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 850,
    background: "linear-gradient(135deg, #2563eb, #4f46e5)",
    boxShadow: "0 12px 28px rgba(37,99,235,0.25)",
  },

  compactInfoBox: {
    position: "relative",
    width: "min(430px, 100%)",
    padding: "34px 28px 24px",
    borderRadius: 22,
    color: "#ffffff",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.99) 0%, rgba(8,18,38,0.99) 100%)",
    border: "1px solid rgba(96,165,250,0.30)",
    boxShadow:
      "0 28px 80px rgba(15,23,42,0.56), 0 0 0 1px rgba(255,255,255,0.02) inset",
  },

  compactCloseButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.20)",
    background: "rgba(15,23,42,0.76)",
    color: "#cbd5e1",
    fontSize: 23,
    lineHeight: 1,
    cursor: "pointer",
  },

  compactInfoHeader: {
    textAlign: "center",
    padding: "4px 28px 24px",
  },

  compactPoiName: {
    margin: 0,
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 1.2,
    fontWeight: 850,
    letterSpacing: "-0.4px",
    wordBreak: "break-word",
  },

  categoryLine: {
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 7,
    color: "#bfdbfe",
    fontSize: 14,
  },

  categoryMain: {
    fontWeight: 800,
    color: "#bfdbfe",
  },

  categorySeparator: {
    color: "#475569",
    fontWeight: 900,
  },

  categorySub: {
    color: "#94a3b8",
    fontWeight: 700,
  },

  compactInfoContent: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  mainInfoRow: {
    minHeight: 64,
    padding: "14px 18px",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    background: "rgba(30,58,104,0.34)",
    border: "1px solid rgba(96,165,250,0.15)",
  },

  mainInfoLabel: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 750,
  },

  mainInfoValue: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: 850,
    letterSpacing: "0.2px",
  },

  compactMeta: {
    minHeight: 62,
    padding: "12px 16px",
    borderRadius: 14,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 14,
    background: "rgba(15,23,42,0.60)",
    border: "1px solid rgba(148,163,184,0.10)",
  },

  metaItem: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 5,
    textAlign: "center",
  },

  metaLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.7px",
  },

  metaValue: {
    color: "#dbeafe",
    fontSize: 13,
    fontWeight: 800,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  metaDivider: {
    width: 1,
    height: 32,
    background: "rgba(148,163,184,0.16)",
  },

  compactDoneButton: {
    width: "100%",
    height: 44,
    marginTop: 20,
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 850,
    background: "linear-gradient(135deg, #2563eb, #4f46e5)",
    boxShadow: "0 12px 26px rgba(37,99,235,0.26)",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottom: "1px solid rgba(148,163,184,0.10)",
  },
  eyebrow: {
    display: "none",
  },
  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: 23,
    lineHeight: 1.2,
    fontWeight: 850,
    letterSpacing: "-0.25px",
  },
  closeButton: {
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(20,38,72,0.88)",
    color: "#cbd5e1",
    fontSize: 22,
    lineHeight: 1,
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 11,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  label: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 800,
    paddingLeft: 1,
  },
  input: {
    width: "100%",
    height: 41,
    padding: "0 12px",
    borderRadius: 8,
    outline: "none",
    color: "#f8fafc",
    background: "rgba(20,38,72,0.88)",
    border: "1px solid rgba(148,163,184,0.18)",
    fontSize: 13,
    boxShadow: "none",
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1.35fr",
    gap: 9,
    marginTop: 16,
    paddingTop: 15,
    borderTop: "1px solid rgba(148,163,184,0.10)",
  },
  cancelButton: {
    height: 40,
    padding: "0 14px",
    borderRadius: 8,
    cursor: "pointer",
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 800,
    background: "rgba(20,38,72,0.88)",
    border: "1px solid rgba(148,163,184,0.16)",
  },
  saveButton: {
    height: 40,
    padding: "0 16px",
    borderRadius: 8,
    cursor: "pointer",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 850,
    background: "rgba(30,58,104,0.96)",
    border: "1px solid rgba(96,165,250,0.20)",
    boxShadow: "none",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 12,
  },
  infoItem: {
    padding: 14,
    borderRadius: 12,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    background: "rgba(15,31,67,0.72)",
    border: "1px solid rgba(148,163,184,0.13)",
  },
  infoLabel: {
    color: "#94a3b8",
    fontSize: 12,
  },
  infoValue: {
    color: "#ffffff",
    fontSize: 14,
  },
};

const heatmapLegendStyles = {
  container: {
    position: "fixed",
    right: 28,
    bottom: 28,
    width: 310,
    zIndex: 9999,
    padding: "18px 18px 16px",
    borderRadius: 18,
    background: "rgba(15, 23, 42, 0.94)",
    border: "1px solid rgba(148, 163, 184, 0.30)",
    boxShadow: "0 18px 45px rgba(2, 6, 23, 0.42)",
    backdropFilter: "blur(12px)",
    color: "#ffffff",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    marginBottom: 14,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(239, 68, 68, 0.16)",
    fontSize: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 800,
    lineHeight: 1.2,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "#cbd5e1",
  },
  scaleWrapper: {
    width: "100%",
  },
  gradient: {
    width: "100%",
    height: 18,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, #0000ff 0%, #00ffff 20%, #00ff00 40%, #ffff00 60%, #ff8000 80%, #ff0000 100%)",
    border: "1px solid rgba(255,255,255,0.35)",
    boxShadow: "inset 0 0 8px rgba(0,0,0,0.22)",
  },
  values: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 7,
    fontSize: 11,
    color: "#e2e8f0",
  },
  labels: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 10,
    fontSize: 12,
    fontWeight: 700,
    color: "#f8fafc",
  },
};

const regionModalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(2, 6, 23, 0.72)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999999,
  },
  box: {
    width: 430,
    background: "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
    borderRadius: 24,
    padding: 30,
    textAlign: "center",
    boxShadow: "0 25px 80px rgba(37,99,235,0.38)",
    border: "1px solid rgba(96,165,250,0.45)",
  },
  icon: {
    width: 76,
    height: 76,
    margin: "0 auto 18px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2563eb, #60a5fa)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: 34,
    boxShadow: "0 12px 30px rgba(37,99,235,0.45)",
  },
  title: {
    fontSize: 28,
    margin: "0 0 12px",
    color: "#ffffff",
    fontWeight: 800,
  },
  text: {
    fontSize: 18,
    color: "#cbd5e1",
    lineHeight: 1.6,
    marginBottom: 26,
  },
  button: {
    border: "none",
    borderRadius: 14,
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "white",
    padding: "13px 42px",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 12px 30px rgba(37,99,235,0.35)",
  },
};
export default MapPage;