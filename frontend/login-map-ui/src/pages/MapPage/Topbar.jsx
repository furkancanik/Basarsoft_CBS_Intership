import { useEffect, useState } from "react";
import axios from "axios";


function TopbarIcon({ type }) {
  const commonProps = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const icons = {
    map: (
      <svg {...commonProps}>
        <path d="M9 18 3.8 20.3A1.2 1.2 0 0 1 2 19.2V5.8a1.2 1.2 0 0 1 .8-1.1L9 2l6 2.4 5.2-2.3A1.2 1.2 0 0 1 22 3.2v13.4a1.2 1.2 0 0 1-.8 1.1L15 20l-6-2Z" />
        <path d="M9 2v16M15 4.4V20" />
      </svg>
    ),
    poi: (
      <svg {...commonProps}>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    ),
    stop: (
      <svg {...commonProps}>
        <rect x="5" y="3" width="14" height="14" rx="2.5" />
        <path d="M8 17v3M16 17v3M5 12h14M8 7h8" />
        <circle cx="8.5" cy="14.5" r=".8" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="14.5" r=".8" fill="currentColor" stroke="none" />
      </svg>
    ),
    route: (
      <svg {...commonProps}>
        <circle cx="5" cy="18" r="2" />
        <circle cx="19" cy="6" r="2" />
        <path d="M7 18h3a3 3 0 0 0 3-3v-6a3 3 0 0 1 3-3h1" />
      </svg>
    ),
    analysis: (
      <svg {...commonProps}>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19V3" />
      </svg>
    ),
    search: (
      <svg {...commonProps}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
    ),
    admin: (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </svg>
    ),
  };

  return icons[type] || null;
}


function Topbar({
  styles,
  activeTool,
  startDraw,
  startInventoryAnalysis,
  username,
  profileImage,
  setProfileImage,
  userMenuOpen,
  setUserMenuOpen,
  minutes,
  seconds,
  logout,
  addMenuOpen,
  setAddMenuOpen,
  layerMenuOpen,
  setLayerMenuOpen,
  visibleLayers,
  toggleLayer,
  visiblePois,
  togglePois,
  clearActiveTool,
  queryPanelOpen,
  setQueryPanelOpen,
  heatmapOpen,
  toggleHeatmap,
  startPoiDraw,
  startTransitStopDraw,
  visibleTransitStopTypes,
  toggleTransitStopType,
  locationAnalysisOpen,
  setLocationAnalysisOpen,
  transitRoutesPanelOpen,
  onToggleTransitRoutesPanel,
  tripManagementPanelOpen,
  onToggleTripManagementPanel,
  transitJourneyPanelOpen,
  onToggleTransitJourneyPanel,
  thematicMapPanelOpen,
  onToggleThematicMapPanel,
  poiSearchContent,
}) {
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningText, setWarningText] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [transitStopMenuOpen, setTransitStopMenuOpen] = useState(false);
  const [transitMenuOpen, setTransitMenuOpen] = useState(false);
  const [mapToolsMenuOpen, setMapToolsMenuOpen] = useState(false);
  const [analysisMenuOpen, setAnalysisMenuOpen] = useState(false);
  const [selectedProfileFile, setSelectedProfileFile] = useState(null);
  const [profileUploadMessage, setProfileUploadMessage] = useState("");
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [menuPermissions, setMenuPermissions] = useState({
    pointCreate: false,
    lineCreate: false,
    polygonCreate: false,
    poiCreate: false,
    transitStopCreate: false,
    transitRouteManage: false,
    inventoryView: false,
    heatmapView: false,
    locationAnalysisView: false,
    queryView: false,
    adminAccess: false,
  });

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5075";

  const config = {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  };

  const getProfileImageSrc = () => {
    if (!profileImage) return "";

    if (profileImage.startsWith("http")) {
      return profileImage;
    }

    return `${API_BASE_URL}${profileImage}`;
  };

  const uploadProfileImage = async () => {
    if (!selectedProfileFile) {
      setProfileUploadMessage("Önce bir fotoğraf seç.");
      return;
    }

    try {
      setIsUploadingProfile(true);
      setProfileUploadMessage("");

      const formData = new FormData();
      formData.append("file", selectedProfileFile);

      const response = await axios.post(
        `${API_BASE_URL}/api/users/upload-profile-image`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setProfileImage(response.data.profileImageUrl || "");
      setSelectedProfileFile(null);
      setProfileUploadMessage("Fotoğraf güncellendi.");
      setIsUploadingProfile(false);
    } catch (error) {
      console.log("Profil fotoğrafı yüklenemedi:", error);
      setProfileUploadMessage("Fotoğraf yüklenemedi.");
      setIsUploadingProfile(false);
    }
  };

  const avatarContent = username ? username.charAt(0).toUpperCase() : "?";
  const profileImageSrc = getProfileImageSrc();

  const normalize = (text) => {
    return String(text || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/\s/g, "")
      .replace(/[._-]/g, "")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ç/g, "c");
  };

  const PERMISSION_ALIASES = {
    pointCreate: [
      "Nokta Oluşturma",
      "Point.Create",
      "PointCreate",
      "Nokta Ekleme",
    ],
    lineCreate: [
      "Hat Oluşturma",
      "Line.Create",
      "LineString.Create",
      "Çizgi Oluşturma",
      "Hat Ekleme",
    ],
    polygonCreate: [
      "Alan Oluşturma",
      "Polygon.Create",
      "Poligon Oluşturma",
      "Alan Ekleme",
    ],
    poiCreate: [
      "POI Oluşturma",
      "POI Ekleme",
      "Poi.Create",
      "POI.Create",
      "PoiCreate",
    ],
    transitStopCreate: [
      "Durak Ekleme",
      "Durak Oluşturma",
      "TransitStop.Create",
      "Stop.Create",
      "Transit.Stop.Create",
    ],
    transitRouteManage: [
      "Güzergah Yönetimi",
      "Güzergah Oluşturma",
      "TransitRoute.Manage",
      "TransitRoute.Create",
      "TransitRoute.Update",
      "Route.Manage",
    ],
    inventoryView: [
      "Envanter",
      "Envanter Görüntüleme",
      "Envanter Analizi",
      "Inventory.View",
      "Inventory.Analysis",
    ],
    heatmapView: [
      "Isı Kontrolü",
      "Isı Haritası",
      "Isı Haritası Görüntüleme",
      "Heatmap.View",
      "Heatmap.Analysis",
    ],
    locationAnalysisView: [
      "Konum Analizi",
      "Konum Analizi Görüntüleme",
      "LocationAnalysis.View",
      "Location.Analysis",
    ],
    queryView: [
      "Sorgulama",
      "Sorgulama Görüntüleme",
      "Sorgu",
      "Query.View",
      "Query",
    ],
    adminAccess: [
      "Yönetim Paneli",
      "Admin.Access",
      "Admin Paneli",
      "Yönetim",
    ],
  };

  const permissionMatches = (permissionName, aliases) => {
    const normalizedPermission = normalize(permissionName);

    return aliases.some(
      (alias) => normalize(alias) === normalizedPermission
    );
  };

  const buildPermissionState = ({
    isAdmin,
    isOperator,
    rolePermissionNames,
    directPermissionNames,
  }) => {
    if (isAdmin) {
      return {
        pointCreate: true,
        lineCreate: true,
        polygonCreate: true,
        poiCreate: true,
        transitStopCreate: true,
        transitRouteManage: true,
        inventoryView: true,
        heatmapView: true,
        locationAnalysisView: true,
        queryView: true,
        adminAccess: true,
      };
    }

    const grantedPermissionNames = [
      ...rolePermissionNames,
      ...directPermissionNames,
    ];

    const hasPermission = (permissionKey) =>
      grantedPermissionNames.some((permissionName) =>
        permissionMatches(
          permissionName,
          PERMISSION_ALIASES[permissionKey]
        )
      );

    return {
      pointCreate: hasPermission("pointCreate"),
      lineCreate: hasPermission("lineCreate"),
      polygonCreate: hasPermission("polygonCreate"),
      poiCreate: hasPermission("poiCreate"),
      transitStopCreate:
        isOperator || hasPermission("transitStopCreate"),
      transitRouteManage:
        isOperator || hasPermission("transitRouteManage"),
      inventoryView: hasPermission("inventoryView"),
      heatmapView: hasPermission("heatmapView"),
      locationAnalysisView: hasPermission("locationAnalysisView"),
      queryView: hasPermission("queryView"),
      adminAccess: hasPermission("adminAccess"),
    };
  };

  const loadMenuPermissions = async () => {
    if (!username) {
      setPermissionsLoading(false);
      return;
    }

    try {
      setPermissionsLoading(true);

      const [userRolesRes, rolePermissionsRes, userPermissionsRes] =
        await Promise.all([
          axios.get(`${API_BASE_URL}/api/userroles`, config),
          axios.get(`${API_BASE_URL}/api/rolepermissions`, config),
          axios.get(`${API_BASE_URL}/api/userpermissions`, config),
        ]);

      const userRoles = Array.isArray(userRolesRes.data)
        ? userRolesRes.data
        : [];
      const rolePermissions = Array.isArray(rolePermissionsRes.data)
        ? rolePermissionsRes.data
        : [];
      const userPermissions = Array.isArray(userPermissionsRes.data)
        ? userPermissionsRes.data
        : [];

      const currentUserRoles = userRoles.filter((item) => {
        const itemUsername = item.username ?? item.userName;

        return normalize(itemUsername) === normalize(username);
      });

      const isAdmin = currentUserRoles.some(
        (item) => normalize(item.roleName) === normalize("admin")
      );

      const isOperator = currentUserRoles.some((item) => {
        const normalizedRoleName = normalize(item.roleName);

        return [
          normalize("Operator"),
          normalize("Operatör"),
          normalize("Ulaşım Operatörü"),
          normalize("Ulasim Operatoru"),
        ].includes(normalizedRoleName);
      });

      const currentRoleNames = currentUserRoles.map(
        (item) => normalize(item.roleName)
      );

      const rolePermissionNames = rolePermissions
        .filter((item) =>
          currentRoleNames.includes(normalize(item.roleName))
        )
        .map((item) => item.permissionName)
        .filter(Boolean);

      const directPermissionNames = userPermissions
        .filter((item) => {
          const itemUsername = item.username ?? item.userName;

          return normalize(itemUsername) === normalize(username);
        })
        .map((item) => item.permissionName)
        .filter(Boolean);

      const permissionState = buildPermissionState({
        isAdmin,
        isOperator,
        rolePermissionNames,
        directPermissionNames,
      });

      setMenuPermissions(permissionState);
    } catch (error) {
      console.log("Menü yetkileri yüklenemedi:", error);

      setMenuPermissions({
        pointCreate: false,
        lineCreate: false,
        polygonCreate: false,
        poiCreate: false,
        transitStopCreate: false,
        transitRouteManage: false,
        inventoryView: false,
        heatmapView: false,
        locationAnalysisView: false,
        queryView: false,
        adminAccess: false,
      });
    } finally {
      setPermissionsLoading(false);
    }
  };

  useEffect(() => {
    loadMenuPermissions();
  }, [username]);

  const canShowDrawMenu =
    menuPermissions.pointCreate ||
    menuPermissions.lineCreate ||
    menuPermissions.polygonCreate;

  const protectedDraw = (type, permissionKey) => {
    if (!menuPermissions[permissionKey]) {
      setWarningText("Bu çizim aracı için yetkiniz bulunmuyor.");
      setWarningOpen(true);
      return;
    }

    startDraw(type);
  };

  const goToAdmin = () => {
    if (!menuPermissions.adminAccess) {
      setWarningText("Yönetim paneline erişim yetkiniz bulunmuyor.");
      setWarningOpen(true);
      return;
    }

    window.location.href = "/admin";
  };

  const goToTransitRouteManagement = () => {
    if (!menuPermissions.transitRouteManage) {
      setWarningText(
        "Güzergah yönetimine erişim yetkiniz bulunmuyor."
      );
      setWarningOpen(true);
      return;
    }

    setTransitMenuOpen(false);
    setMapToolsMenuOpen(false);
    setAnalysisMenuOpen(false);
    setTransitStopMenuOpen(false);
    setAddMenuOpen(false);
    setLayerMenuOpen(false);
    setQueryPanelOpen(false);
    clearActiveTool();

    if (typeof onToggleTransitRoutesPanel === "function") {
      onToggleTransitRoutesPanel();
    }
  };


  const goToTripManagement = () => {
    if (!menuPermissions.transitRouteManage) {
      setWarningText("Sefer yönetimine erişim yetkiniz bulunmuyor.");
      setWarningOpen(true);
      return;
    }

    setTransitMenuOpen(false);
    setMapToolsMenuOpen(false);
    setAnalysisMenuOpen(false);
    setTransitStopMenuOpen(false);
    setAddMenuOpen(false);
    setLayerMenuOpen(false);
    setQueryPanelOpen(false);
    clearActiveTool();

    if (typeof onToggleTripManagementPanel === "function") {
      onToggleTripManagementPanel();
    }
  };

  return (
    <>
      <div style={styles.topbar}>
        <style>
          {`
            .topbar-poi-search {
              position: relative !important;
              height: 44px !important;
              overflow: visible !important;
            }

            .topbar-poi-search > div {
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              right: auto !important;
              bottom: auto !important;
              width: 330px !important;
              max-width: 330px !important;
              z-index: 5000 !important;
            }

            .topbar-poi-search > div > div {
              box-shadow: 0 16px 38px rgba(2, 6, 23, 0.34) !important;
            }

            @keyframes basarsoftLogoEnter {
              0% {
                opacity: 0;
                transform: translate(-180px, -50%) scale(0.96);
              }

              72% {
                opacity: 1;
                transform: translate(10px, -50%) scale(1);
              }

              100% {
                opacity: 1;
                transform: translate(0, -50%) scale(1);
              }
            }

            .topbar-basarsoft-logo {
              position: absolute;
              top: 50%;
              left: 78px;
              width: 230px;
              height: 54px;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0;
              box-sizing: border-box;
              border-radius: 0;
              background: transparent;
              border: none;
              box-shadow: none;
              animation: basarsoftLogoEnter 2.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
              pointer-events: none;
              user-select: none;
              z-index: 20;
            }

            .topbar-basarsoft-logo img {
              display: block;
              width: 100%;
              height: 100%;
              object-fit: contain;
              filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
            }

            @media (max-width: 1180px) {
              .topbar-basarsoft-logo {
                width: 170px;
                left: 72px;
              }
            }

            @media (max-width: 980px) {
              .topbar-basarsoft-logo {
                display: none;
              }
            }

            @media (prefers-reduced-motion: reduce) {
              .topbar-basarsoft-logo {
                animation: none;
                opacity: 1;
                transform: translate(0, -50%);
              }
            }

            .topbar-transit-menu {
              position: absolute;
              top: calc(100% + 9px);
              left: 50%;
              transform: translateX(-50%);
              width: 320px;
              padding: 10px;
              border-radius: 14px;
              border: 1px solid rgba(96,165,250,0.24);
              background: linear-gradient(160deg, rgba(3,18,40,0.99), rgba(7,31,61,0.99));
              box-shadow: 0 24px 58px rgba(2,6,23,0.48);
              backdrop-filter: blur(18px);
              z-index: 7000;
            }

            .topbar-transit-title {
              padding: 4px 7px 9px;
              color: #7dd3fc;
              font-size: 10px;
              font-weight: 900;
              letter-spacing: .11em;
              text-transform: uppercase;
            }

            .topbar-transit-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 7px;
            }

            .topbar-transit-item {
              min-height: 58px;
              padding: 9px 10px;
              display: flex;
              align-items: center;
              gap: 9px;
              border-radius: 10px;
              border: 1px solid rgba(148,163,184,0.15);
              background: rgba(15,23,42,0.72);
              color: #e2e8f0;
              cursor: pointer;
              text-align: left;
              transition: 150ms ease;
            }

            .topbar-transit-item:hover {
              transform: translateY(-1px);
              border-color: rgba(96,165,250,0.38);
              background: rgba(30,64,175,0.20);
            }

            .topbar-transit-item.is-active {
              border-color: rgba(56,189,248,0.52);
              background: linear-gradient(145deg, rgba(3,105,161,0.38), rgba(37,99,235,0.25));
            }

            .topbar-transit-item-icon {
              width: 30px;
              height: 30px;
              flex: 0 0 30px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border-radius: 9px;
              background: rgba(37,99,235,0.18);
              color: #93c5fd;
              font-size: 16px;
            }

            .topbar-transit-item-copy {
              min-width: 0;
              display: flex;
              flex-direction: column;
              gap: 2px;
            }

            .topbar-transit-item-title {
              color: #f8fafc;
              font-size: 12px;
              font-weight: 850;
              line-height: 1.2;
            }

            .topbar-transit-item-desc {
              color: #94a3b8;
              font-size: 9.5px;
              font-weight: 600;
              line-height: 1.25;
            }

            .topbar-transit-divider {
              height: 1px;
              margin: 10px 4px;
              background: rgba(148,163,184,0.13);
            }

            @media (max-width: 1120px) {
              .topbar-transit-menu {
                width: 290px;
              }

              .topbar-transit-item-desc {
                display: none;
              }

              .topbar-transit-item {
                min-height: 48px;
              }
            }
          `}
        </style>

        <div
          className="topbar-poi-search"
          style={styles.leftSearchSlot}
        >
          {poiSearchContent}
        </div>

        <div
          className="topbar-basarsoft-logo"
          aria-hidden="true"
        >
          <img
            src="/transit-icons/basarsoft-logo.png"
            alt=""
            draggable="false"
          />
        </div>

        <div style={styles.centerTools}>
          {!permissionsLoading && (
            <div style={styles.layerMenuWrapper}>
              <button
                type="button"
                aria-label="Harita araçları"
                title="Çizim ve Katman Araçları"
                onClick={() => {
                  setMapToolsMenuOpen(!mapToolsMenuOpen);
                  setTransitMenuOpen(false);
                  setAnalysisMenuOpen(false);
                  setTransitStopMenuOpen(false);
                  setAddMenuOpen(false);
                  setLayerMenuOpen(false);
                  setQueryPanelOpen(false);
                  clearActiveTool();
                }}
                style={{
                  ...styles.iconToolButton,
                  ...(mapToolsMenuOpen ||
                  activeTool === "Point" ||
                  activeTool === "LineString" ||
                  activeTool === "Polygon" ||
                  activeTool === "Poi"
                    ? styles.activeIconToolButton
                    : {}),
                }}
              >
                <span style={styles.toolIcon}><TopbarIcon type="map" /></span><span style={styles.toolLabel}>Harita</span>
                <span style={styles.menuChevron}>
                  {mapToolsMenuOpen ? "▲" : "▼"}
                </span>
              </button>

              {mapToolsMenuOpen && (
                <div style={styles.combinedMapDropdown}>
                  <div style={styles.dropdownSectionTitle}>
                    Katmanlar ve çizim
                  </div>

                  <div style={styles.combinedLayerRow}>
                    <label style={styles.combinedLayerVisibility}>
                      <input
                        type="checkbox"
                        checked={visibleLayers.Point}
                        onChange={() => toggleLayer("Point")}
                        style={styles.layerCheckbox}
                      />
                      <span style={styles.pointMiniIcon} />
                      <span>Nokta</span>
                    </label>

                    {menuPermissions.pointCreate && (
                      <button
                        type="button"
                        title="Yeni nokta ekle"
                        aria-label="Yeni nokta ekle"
                        onClick={() => {
                          setMapToolsMenuOpen(false);
                          protectedDraw("Point", "pointCreate");
                        }}
                        style={styles.addGeometryButton}
                      >
                        +
                      </button>
                    )}
                  </div>

                  <div style={styles.combinedLayerRow}>
                    <label style={styles.combinedLayerVisibility}>
                      <input
                        type="checkbox"
                        checked={visibleLayers.LineString}
                        onChange={() => toggleLayer("LineString")}
                        style={styles.layerCheckbox}
                      />
                      <span style={styles.lineMiniIcon} />
                      <span>Çizgi</span>
                    </label>

                    {menuPermissions.lineCreate && (
                      <button
                        type="button"
                        title="Yeni çizgi ekle"
                        aria-label="Yeni çizgi ekle"
                        onClick={() => {
                          setMapToolsMenuOpen(false);
                          protectedDraw("LineString", "lineCreate");
                        }}
                        style={styles.addGeometryButton}
                      >
                        +
                      </button>
                    )}
                  </div>

                  <div style={styles.combinedLayerRow}>
                    <label style={styles.combinedLayerVisibility}>
                      <input
                        type="checkbox"
                        checked={visibleLayers.Polygon}
                        onChange={() => toggleLayer("Polygon")}
                        style={styles.layerCheckbox}
                      />
                      <span style={styles.polygonMiniIcon}>⬡</span>
                      <span>Poligon</span>
                    </label>

                    {menuPermissions.polygonCreate && (
                      <button
                        type="button"
                        title="Yeni poligon ekle"
                        aria-label="Yeni poligon ekle"
                        onClick={() => {
                          setMapToolsMenuOpen(false);
                          protectedDraw("Polygon", "polygonCreate");
                        }}
                        style={styles.addGeometryButton}
                      >
                        +
                      </button>
                    )}
                  </div>

                  <div style={styles.combinedLayerRow}>
                    <label style={styles.combinedLayerVisibility}>
                      <input
                        type="checkbox"
                        checked={visiblePois}
                        onChange={togglePois}
                        style={styles.layerCheckbox}
                      />
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: "50% 50% 50% 0",
                          transform: "rotate(-45deg)",
                          border: "2px solid #60a5fa",
                          boxSizing: "border-box",
                          flexShrink: 0,
                          marginLeft: 2,
                          marginRight: 2,
                        }}
                      />
                      <span>POI</span>
                    </label>

                    {menuPermissions.poiCreate && (
                      <button
                        type="button"
                        title="Yeni POI ekle"
                        aria-label="Yeni POI ekle"
                        onClick={() => {
                          setMapToolsMenuOpen(false);
                          clearActiveTool();

                          if (typeof startPoiDraw === "function") {
                            startPoiDraw();
                          } else {
                            setWarningText(
                              "POI ekleme aracı harita sayfasına henüz bağlanmadı."
                            );
                            setWarningOpen(true);
                          }
                        }}
                        style={styles.addGeometryButton}
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {!permissionsLoading && (
              <div style={styles.layerMenuWrapper}>
                <button
                  type="button"
                  aria-label="Ulaşım işlemleri"
                  title="Ulaşım"
                  onClick={() => {
                    setTransitMenuOpen(!transitMenuOpen);
                    setMapToolsMenuOpen(false);
                    setAnalysisMenuOpen(false);
                    setTransitStopMenuOpen(false);
                    setAddMenuOpen(false);
                    setLayerMenuOpen(false);
                    setQueryPanelOpen(false);
                    clearActiveTool();
                  }}
                  style={{
                    ...styles.iconToolButton,
                    ...(transitMenuOpen ||
                    activeTool === "TransitStop" ||
                    transitRoutesPanelOpen ||
                    tripManagementPanelOpen ||
                    transitJourneyPanelOpen ||
                    thematicMapPanelOpen
                      ? styles.activeIconToolButton
                      : {}),
                  }}
                >
                  <span style={styles.toolIcon}>
                    <TopbarIcon type="route" />
                  </span>
                  <span style={styles.toolLabel}>Ulaşım</span>
                  <span style={styles.menuChevron}>
                    {transitMenuOpen ? "▲" : "▼"}
                  </span>
                </button>

                {transitMenuOpen && (
                  <div className="topbar-transit-menu">
                    <div className="topbar-transit-title">
                      Toplu taşıma
                    </div>

                    <div className="topbar-transit-grid">
                      {menuPermissions.transitStopCreate && (
                        <button
                          type="button"
                          className={`topbar-transit-item ${
                            activeTool === "TransitStop"
                              ? "is-active"
                              : ""
                          }`}
                          onClick={() => {
                            setTransitMenuOpen(false);
                            startTransitStopDraw?.("Bus");
                          }}
                        >
                          <span className="topbar-transit-item-icon">🚏</span>
                          <span className="topbar-transit-item-copy">
                            <span className="topbar-transit-item-title">
                              Durak Ekle
                            </span>
                            <span className="topbar-transit-item-desc">
                              Otobüs veya metro durağı oluştur
                            </span>
                          </span>
                        </button>
                      )}

                      {menuPermissions.transitRouteManage && (
                        <button
                          type="button"
                          className={`topbar-transit-item ${
                            transitRoutesPanelOpen ? "is-active" : ""
                          }`}
                          onClick={goToTransitRouteManagement}
                        >
                          <span className="topbar-transit-item-icon">⇄</span>
                          <span className="topbar-transit-item-copy">
                            <span className="topbar-transit-item-title">
                              Güzergah Yönetimi
                            </span>
                            <span className="topbar-transit-item-desc">
                              Hat, durak ve rota işlemleri
                            </span>
                          </span>
                        </button>
                      )}

                      {menuPermissions.transitRouteManage && (
                        <button
                          type="button"
                          className={`topbar-transit-item ${
                            tripManagementPanelOpen ? "is-active" : ""
                          }`}
                          onClick={goToTripManagement}
                        >
                          <span className="topbar-transit-item-icon">🕒</span>
                          <span className="topbar-transit-item-copy">
                            <span className="topbar-transit-item-title">
                              Sefer Yönetimi
                            </span>
                            <span className="topbar-transit-item-desc">
                              Takvim ve kalkış saatleri
                            </span>
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        className={`topbar-transit-item ${
                          transitJourneyPanelOpen ? "is-active" : ""
                        }`}
                        onClick={() => {
                          setTransitMenuOpen(false);
                          onToggleTransitJourneyPanel?.();
                        }}
                      >
                        <span className="topbar-transit-item-icon">🧭</span>
                        <span className="topbar-transit-item-copy">
                          <span className="topbar-transit-item-title">
                            Yol Tarifi
                          </span>
                          <span className="topbar-transit-item-desc">
                            Yürü → bin → in → yürü
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`topbar-transit-item ${
                          thematicMapPanelOpen ? "is-active" : ""
                        }`}
                        onClick={() => {
                          setTransitMenuOpen(false);
                          onToggleThematicMapPanel?.();
                        }}
                      >
                        <span className="topbar-transit-item-icon">◉</span>
                        <span className="topbar-transit-item-copy">
                          <span className="topbar-transit-item-title">
                            Tematik Harita
                          </span>
                          <span className="topbar-transit-item-desc">
                            Yoğunluk ve erişim katmanları
                          </span>
                        </span>
                      </button>
                    </div>

                    {menuPermissions.transitStopCreate && (
                      <>
                        <div className="topbar-transit-divider" />

                        <div className="topbar-transit-title">
                          Durak görünürlüğü
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 7,
                          }}
                        >
                          <label
                            style={{
                              minHeight: 38,
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "0 10px",
                              borderRadius: 9,
                              border:
                                "1px solid rgba(148,163,184,0.14)",
                              background: "rgba(15,23,42,0.66)",
                              color: "#cbd5e1",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={visibleTransitStopTypes?.Bus !== false}
                              onChange={() =>
                                toggleTransitStopType?.("Bus")
                              }
                            />
                            Otobüs
                          </label>

                          <label
                            style={{
                              minHeight: 38,
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "0 10px",
                              borderRadius: 9,
                              border:
                                "1px solid rgba(148,163,184,0.14)",
                              background: "rgba(15,23,42,0.66)",
                              color: "#cbd5e1",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={visibleTransitStopTypes?.Metro !== false}
                              onChange={() =>
                                toggleTransitStopType?.("Metro")
                              }
                            />
                            Metro
                          </label>
                        </div>

                        <div
                          style={{
                            marginTop: 7,
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 7,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setTransitMenuOpen(false);
                              startTransitStopDraw?.("Bus");
                            }}
                            style={{
                              height: 36,
                              borderRadius: 9,
                              border:
                                "1px solid rgba(59,130,246,0.28)",
                              background: "rgba(37,99,235,0.16)",
                              color: "#bfdbfe",
                              fontWeight: 800,
                              fontSize: 10.5,
                              cursor: "pointer",
                            }}
                          >
                            + Otobüs Durağı
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setTransitMenuOpen(false);
                              startTransitStopDraw?.("Metro");
                            }}
                            style={{
                              height: 36,
                              borderRadius: 9,
                              border:
                                "1px solid rgba(139,92,246,0.30)",
                              background: "rgba(124,58,237,0.15)",
                              color: "#ddd6fe",
                              fontWeight: 800,
                              fontSize: 10.5,
                              cursor: "pointer",
                            }}
                          >
                            + Metro Durağı
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

          {!permissionsLoading &&
            (menuPermissions.inventoryView ||
              menuPermissions.heatmapView ||
              menuPermissions.locationAnalysisView) && (
              <div style={styles.layerMenuWrapper}>
                <button
                  type="button"
                  aria-label="Analiz araçları"
                  title="Analiz Araçları"
                  onClick={() => {
                    setAnalysisMenuOpen(!analysisMenuOpen);
                    setTransitMenuOpen(false);
                    setMapToolsMenuOpen(false);
                    setTransitStopMenuOpen(false);
                    setAddMenuOpen(false);
                    setLayerMenuOpen(false);
                    setQueryPanelOpen(false);
                    clearActiveTool();
                  }}
                  style={{
                    ...styles.iconToolButton,
                    ...(analysisMenuOpen ||
                    heatmapOpen ||
                    locationAnalysisOpen
                      ? styles.activeIconToolButton
                      : {}),
                  }}
                >
                  <span style={styles.toolIcon}><TopbarIcon type="analysis" /></span><span style={styles.toolLabel}>Analiz</span>
                  <span style={styles.menuChevron}>
                    {analysisMenuOpen ? "▲" : "▼"}
                  </span>
                </button>

                {analysisMenuOpen && (
                  <div style={styles.analysisDropdown}>
                    <div style={styles.dropdownSectionTitle}>
                      Analiz araçları
                    </div>

                    {menuPermissions.inventoryView && (
                      <button
                        type="button"
                        onClick={() => {
                          setAnalysisMenuOpen(false);
                          startInventoryAnalysis();
                        }}
                        style={styles.analysisMenuItem}
                      >
                        <span style={styles.analysisMenuTitle}>
                          Envanter Analizi
                        </span>
                      </button>
                    )}

                    {menuPermissions.heatmapView && (
                      <button
                        type="button"
                        onClick={() => {
                          setAnalysisMenuOpen(false);
                          clearActiveTool();
                          toggleHeatmap();
                        }}
                        style={{
                          ...styles.analysisMenuItem,
                          ...(heatmapOpen
                            ? styles.activeAnalysisMenuItem
                            : {}),
                        }}
                      >
                        <span style={styles.analysisMenuTitle}>
                          Isı Haritası
                        </span>
                      </button>
                    )}

                    {menuPermissions.locationAnalysisView && (
                      <button
                        type="button"
                        onClick={() => {
                          setLocationAnalysisOpen(!locationAnalysisOpen);
                          setAnalysisMenuOpen(false);
                          clearActiveTool();
                        }}
                        style={{
                          ...styles.analysisMenuItem,
                          ...(locationAnalysisOpen
                            ? styles.activeAnalysisMenuItem
                            : {}),
                        }}
                      >
                        <span style={styles.analysisMenuTitle}>
                          Konum Analizi
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

          {!permissionsLoading && menuPermissions.queryView && (
            <button
              type="button"
              aria-label="Sorgulama paneli"
              title="Sorgulama Paneli"
              onClick={() => {
                setQueryPanelOpen(!queryPanelOpen);
                setTransitMenuOpen(false);
                setMapToolsMenuOpen(false);
                setAnalysisMenuOpen(false);
                setTransitStopMenuOpen(false);
                setAddMenuOpen(false);
                setLayerMenuOpen(false);
                clearActiveTool();
              }}
              style={{
                ...styles.iconToolButton,
                ...(queryPanelOpen ? styles.activeIconToolButton : {}),
              }}
            >
              <span style={styles.toolIcon}><TopbarIcon type="search" /></span><span style={styles.toolLabel}>Sorgulama</span>
            </button>
          )}

          {!permissionsLoading && menuPermissions.adminAccess && (
            <>
              <div style={styles.toolbarDivider} />

              <button
                type="button"
                aria-label="Yönetim paneli"
                title="Yönetim Paneli"
                onClick={goToAdmin}
                style={styles.iconToolButton}
              >
                <span style={styles.toolIcon}><TopbarIcon type="admin" /></span><span style={styles.toolLabel}>Admin</span>
              </button>
            </>
          )}
        </div>

        <div style={styles.rightTools}>
          <div style={styles.userMenuWrapper}>
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(!userMenuOpen);
                setProfileMenuOpen(false);
              }}
              style={styles.compactUserButton}
            >
              {profileImageSrc ? (
                <img
                  src={profileImageSrc}
                  alt="Profil"
                  style={styles.compactAvatarImage}
                />
              ) : (
                <span style={styles.compactAvatarFallback}>
                  {avatarContent}
                </span>
              )}

              <span style={styles.compactUsername}>{username}</span><span style={styles.userChevron}>⌄</span>
            </button>

            {userMenuOpen && (
              <div style={styles.userDropdown}>
                <div style={styles.dropdownRow}>
                  Kalan Süre : {minutes}:{seconds.toString().padStart(2, "0")}
                </div>

                <button
                  type="button"
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  style={{
                    ...styles.dropdownLogout,
                    background: "#2563eb",
                    marginBottom: 10,
                  }}
                >
                  Bilgilerim
                </button>

                {profileMenuOpen && (
                  <div style={styles.profilePanel}>
                    <div style={styles.profileHeader}>
                      {profileImageSrc ? (
                        <img
                          src={profileImageSrc}
                          alt="Profil"
                          style={styles.profileLargeImage}
                        />
                      ) : (
                        <div style={styles.profileLargeFallback}>
                          {avatarContent}
                        </div>
                      )}

                      <div>
                        <div style={{ fontWeight: 800 }}>{username}</div>
                        <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                          Profil fotoğrafı
                        </div>
                      </div>
                    </div>

                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={(event) =>
                        setSelectedProfileFile(
                          event.target.files?.[0] || null
                        )
                      }
                      style={styles.profileFileInput}
                    />

                    <button
                      type="button"
                      onClick={uploadProfileImage}
                      disabled={isUploadingProfile}
                      style={styles.profileSaveButton}
                    >
                      {isUploadingProfile
                        ? "Yükleniyor..."
                        : "Fotoğrafı Kaydet"}
                    </button>

                    {profileUploadMessage && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 12,
                          color: profileUploadMessage.includes("güncellendi")
                            ? "#86efac"
                            : "#fecaca",
                        }}
                      >
                        {profileUploadMessage}
                      </div>
                    )}
                  </div>
                )}

                <button onClick={logout} style={styles.dropdownLogout}>
                  Çıkış Yap
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {warningOpen && (
        <div style={modalStyles.overlay}>
          <div style={modalStyles.box}>
            <div style={modalStyles.icon}>🔒</div>
            <h2 style={modalStyles.title}>Erişim Yok</h2>
            <p style={modalStyles.text}>{warningText}</p>
            <button
              onClick={() => setWarningOpen(false)}
              style={modalStyles.button}
            >
              Tamam
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const modalStyles = {
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
    fontSize: 17,
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

export default Topbar;