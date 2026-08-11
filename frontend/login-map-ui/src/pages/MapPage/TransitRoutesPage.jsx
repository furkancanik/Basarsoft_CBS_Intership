import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import AdminPopup from "../Admin/AdminPopup";

const API_BASE_URL = "http://localhost:5075";

function TransitRoutesPanel({ onClose }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchText, setSearchText] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const [routeName, setRouteName] = useState("");
  const [routeShortCode, setRouteShortCode] = useState("");
  const [routeColor, setRouteColor] = useState("#2563eb");

  const [selectedRoute, setSelectedRoute] = useState(null);
  const [editingRoute, setEditingRoute] = useState(null);
  const [routeToDelete, setRouteToDelete] = useState(null);

  const [editName, setEditName] = useState("");
  const [editShortCode, setEditShortCode] = useState("");
  const [editColor, setEditColor] = useState("#2563eb");
  const [editIsActive, setEditIsActive] = useState(true);

  const [orderedStops, setOrderedStops] = useState([]);
  const [draggedStopId, setDraggedStopId] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const [generatingRouteId, setGeneratingRouteId] = useState(null);
  const [simulationActionRouteId, setSimulationActionRouteId] = useState(null);
  const [simulationsByRouteId, setSimulationsByRouteId] = useState({});

  const token = localStorage.getItem("token");

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);

    window.setTimeout(() => {
      setMessage("");
    }, 3500);
  };

  const getErrorMessage = (error, fallbackMessage) => {
    const responseData = error.response?.data;

    if (responseData?.message) {
      return responseData.message;
    }

    if (typeof responseData === "string") {
      return responseData;
    }

    return fallbackMessage;
  };

  const normalizeSimulation = (value) => {
    if (!value) return null;

    const routeId = Number(value.routeId ?? value.RouteId);

    if (!Number.isInteger(routeId) || routeId <= 0) {
      return null;
    }

    return {
      routeId,
      routeName: value.routeName ?? value.RouteName ?? "",
      shortCode: value.shortCode ?? value.ShortCode ?? "",
      routeColor: value.routeColor ?? value.RouteColor ?? "#2563eb",
      vehicleType: value.vehicleType ?? value.VehicleType ?? "Bus",
      isRunning: value.isRunning ?? value.IsRunning ?? false,
      progress: Number(value.progress ?? value.Progress ?? 0),
      longitude: Number(value.longitude ?? value.Longitude ?? 0),
      latitude: Number(value.latitude ?? value.Latitude ?? 0),
      startedDate: value.startedDate ?? value.StartedDate ?? null,
      lastUpdatedDate: value.lastUpdatedDate ?? value.LastUpdatedDate ?? null,
    };
  };

  const loadRunningSimulations = async ({  silent = false } = {}) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/TransitRoutes/simulations/running`,
        config
      );

      const items = Array.isArray(response.data)
        ? response.data
        : [];

      const nextSimulations = {};

      items.forEach((item) => {
        const normalizedSimulation = normalizeSimulation(item);

        if (normalizedSimulation) {
          nextSimulations[normalizedSimulation.routeId] =
            normalizedSimulation;
        }
      });

      setSimulationsByRouteId(nextSimulations);
      return nextSimulations;
    } catch (error) {
      console.error("Çalışan simülasyonlar alınamadı:", error);

      if (!silent) {
        showMessage(
          getErrorMessage(
            error,
            "Araç simülasyonu bilgileri alınırken hata oluştu."
          ),
          "error"
        );
      }

      return {};
    }
  };

  const loadRoutes = async () => {
    try {
      setLoading(true);

      const response = await axios.get(
        `${API_BASE_URL}/api/TransitRoutes`,
        config
      );

      setRoutes(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      console.error("Güzergahlar alınamadı:", error);

      showMessage(
        getErrorMessage(
          error,
          "Güzergahlar yüklenirken hata oluştu."
        ),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes();
    loadRunningSimulations({ silent: true });

    const simulationRefreshInterval = window.setInterval(() => {
      loadRunningSimulations({ silent: true });
    }, 2000);

    return () => {
      window.clearInterval(simulationRefreshInterval);
    };
  }, []);

  const filteredRoutes = useMemo(() => {
    const normalizedSearch = searchText
      .trim()
      .toLocaleLowerCase("tr-TR");

    if (!normalizedSearch) {
      return routes;
    }

    return routes.filter((route) => {
      const routeNameValue =
        route.name?.toLocaleLowerCase("tr-TR") ?? "";

      const shortCodeValue =
        route.shortCode?.toLocaleLowerCase("tr-TR") ?? "";

      return (
        routeNameValue.includes(normalizedSearch) ||
        shortCodeValue.includes(normalizedSearch)
      );
    });
  }, [routes, searchText]);

  const handleCreateRoute = async (event) => {
    event.preventDefault();

    if (!routeName.trim()) {
      showMessage(
        "Güzergah adı boş olamaz.",
        "error"
      );
      return;
    }

    if (!routeShortCode.trim()) {
      showMessage(
        "Güzergah kısa kodu boş olamaz.",
        "error"
      );
      return;
    }

    try {
      setLoading(true);

      await axios.post(
        `${API_BASE_URL}/api/TransitRoutes`,
        {
          name: routeName.trim(),
          shortCode: routeShortCode.trim().toUpperCase(),
          color: routeColor,
        },
        config
      );

      setRouteName("");
      setRouteShortCode("");
      setRouteColor("#2563eb");

      showMessage(
        "Güzergah başarıyla eklendi."
      );

      await loadRoutes();
    } catch (error) {
      console.error(
        "Güzergah eklenemedi:",
        error
      );

      showMessage(
        getErrorMessage(
          error,
          "Güzergah eklenirken hata oluştu."
        ),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const openDetailModal = (route) => {
    const sortedStops = Array.isArray(route.stops)
      ? [...route.stops].sort(
          (firstStop, secondStop) =>
            Number(firstStop.orderNo || 0) -
            Number(secondStop.orderNo || 0)
        )
      : [];

    setSelectedRoute(route);
    setOrderedStops(sortedStops);
    setDraggedStopId(null);
    setOrderChanged(false);
  };

  const closeDetailModal = () => {
    if (savingOrder) {
      return;
    }

    setSelectedRoute(null);
    setOrderedStops([]);
    setDraggedStopId(null);
    setOrderChanged(false);
  };

  const openEditModal = (route) => {
    setEditingRoute(route);
    setEditName(route.name ?? "");
    setEditShortCode(route.shortCode ?? "");
    setEditColor(route.color ?? "#2563eb");
    setEditIsActive(route.isActive ?? true);
  };

  const closeEditModal = () => {
    setEditingRoute(null);
    setEditName("");
    setEditShortCode("");
    setEditColor("#2563eb");
    setEditIsActive(true);
  };

  const handleUpdateRoute = async (event) => {
    event.preventDefault();

    if (!editingRoute) {
      return;
    }

    if (!editName.trim()) {
      showMessage(
        "Güzergah adı boş olamaz.",
        "error"
      );
      return;
    }

    if (!editShortCode.trim()) {
      showMessage(
        "Güzergah kısa kodu boş olamaz.",
        "error"
      );
      return;
    }

    try {
      setLoading(true);

      await axios.put(
        `${API_BASE_URL}/api/TransitRoutes/${editingRoute.id}`,
        {
          name: editName.trim(),
          shortCode: editShortCode.trim().toUpperCase(),
          color: editColor,
          isActive: editIsActive,
        },
        config
      );

      closeEditModal();

      showMessage(
        "Güzergah başarıyla güncellendi."
      );

      await loadRoutes();
    } catch (error) {
      console.error(
        "Güzergah güncellenemedi:",
        error
      );

      showMessage(
        getErrorMessage(
          error,
          "Güzergah güncellenirken hata oluştu."
        ),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStopDragStart = (event, stopId) => {
    setDraggedStopId(stopId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(stopId));
  };

  const handleStopDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleStopDrop = (event, targetStopId) => {
    event.preventDefault();

    const sourceStopId = Number(
      event.dataTransfer.getData("text/plain") || draggedStopId
    );

    if (
      !sourceStopId ||
      sourceStopId === Number(targetStopId)
    ) {
      setDraggedStopId(null);
      return;
    }

    setOrderedStops((currentStops) => {
      const sourceIndex = currentStops.findIndex(
        (stop) => Number(stop.id) === Number(sourceStopId)
      );

      const targetIndex = currentStops.findIndex(
        (stop) => Number(stop.id) === Number(targetStopId)
      );

      if (sourceIndex < 0 || targetIndex < 0) {
        return currentStops;
      }

      const nextStops = [...currentStops];
      const [movedStop] = nextStops.splice(sourceIndex, 1);
      nextStops.splice(targetIndex, 0, movedStop);

      return nextStops.map((stop, index) => ({
        ...stop,
        orderNo: index + 1,
      }));
    });

    setDraggedStopId(null);
    setOrderChanged(true);
  };

  const generateOsrmRoute = async (
    route,
    successMessage = "Rota local Docker OSRM kullanılarak başarıyla oluşturuldu."
  ) => {
    if (!route?.id) {
      return null;
    }

    const stopCount = Number(
      route.stopCount ?? route.stops?.length ?? 0
    );

    if (stopCount < 2) {
      showMessage(
        "Rota oluşturmak için güzergaha en az 2 aktif durak eklenmelidir.",
        "error"
      );
      return null;
    }

    try {
      setGeneratingRouteId(route.id);

      const response = await axios.post(
        `${API_BASE_URL}/api/TransitRoutes/${route.id}/generate-route`,
        {},
        config
      );

      const generatedRoute = response.data ?? {};

      setRoutes((currentRoutes) =>
        currentRoutes.map((currentRoute) =>
          Number(currentRoute.id) === Number(route.id)
            ? {
                ...currentRoute,
                routeWkt:
                  generatedRoute.routeWkt ??
                  generatedRoute.RouteWkt ??
                  currentRoute.routeWkt,
                distanceMeters:
                  generatedRoute.distanceMeters ??
                  generatedRoute.DistanceMeters ??
                  currentRoute.distanceMeters,
                durationSeconds:
                  generatedRoute.durationSeconds ??
                  generatedRoute.DurationSeconds ??
                  currentRoute.durationSeconds,
                routeUpdatedDate:
                  generatedRoute.routeUpdatedDate ??
                  generatedRoute.RouteUpdatedDate ??
                  currentRoute.routeUpdatedDate,
                hasGeneratedRoute: true,
              }
            : currentRoute
        )
      );

      setSelectedRoute((currentRoute) => {
        if (
          !currentRoute ||
          Number(currentRoute.id) !== Number(route.id)
        ) {
          return currentRoute;
        }

        return {
          ...currentRoute,
          routeWkt:
            generatedRoute.routeWkt ??
            generatedRoute.RouteWkt ??
            currentRoute.routeWkt,
          distanceMeters:
            generatedRoute.distanceMeters ??
            generatedRoute.DistanceMeters ??
            currentRoute.distanceMeters,
          durationSeconds:
            generatedRoute.durationSeconds ??
            generatedRoute.DurationSeconds ??
            currentRoute.durationSeconds,
          routeUpdatedDate:
            generatedRoute.routeUpdatedDate ??
            generatedRoute.RouteUpdatedDate ??
            currentRoute.routeUpdatedDate,
          hasGeneratedRoute: true,
        };
      });

      showMessage(successMessage);
      return generatedRoute;
    } catch (error) {
      console.error("OSRM rotası oluşturulamadı:", error);

      showMessage(
        getErrorMessage(
          error,
          "Rota oluşturulurken hata oluştu. Docker OSRM servisinin çalıştığını kontrol et."
        ),
        "error"
      );

      return null;
    } finally {
      setGeneratingRouteId(null);
    }
  };

  const startSimulation = async (route) => {
    if (!route?.id) return;

    const stopCount = Number(
      route.stopCount ?? route.stops?.length ?? 0
    );

    if (stopCount < 2) {
      showMessage(
        "Simülasyonu başlatmak için güzergaha en az 2 aktif durak eklenmelidir.",
        "error"
      );
      return;
    }

    if (!(route.hasGeneratedRoute || route.routeWkt)) {
      showMessage(
        "Simülasyonu başlatmadan önce güzergah için OSRM rotası oluşturmalısın.",
        "error"
      );
      return;
    }

    try {
      setSimulationActionRouteId(route.id);

      const response = await axios.post(
        `${API_BASE_URL}/api/TransitRoutes/${route.id}/start-simulation`,
        {},
        config
      );

      const simulation = normalizeSimulation(
        response.data?.simulation ?? response.data
      );

      if (simulation) {
        setSimulationsByRouteId((current) => ({
          ...current,
          [simulation.routeId]: simulation,
        }));
      }

      showMessage(
        response.data?.message ||
          "Araç simülasyonu başarıyla başlatıldı."
      );

      await loadRunningSimulations({ silent: true });
    } catch (error) {
      console.error("Araç simülasyonu başlatılamadı:", error);

      showMessage(
        getErrorMessage(
          error,
          "Araç simülasyonu başlatılırken hata oluştu."
        ),
        "error"
      );
    } finally {
      setSimulationActionRouteId(null);
    }
  };

  const stopSimulation = async (route) => {
    if (!route?.id) return;

    try {
      setSimulationActionRouteId(route.id);

      const response = await axios.post(
        `${API_BASE_URL}/api/TransitRoutes/${route.id}/stop-simulation`,
        {},
        config
      );

      setSimulationsByRouteId((current) => {
        const next = { ...current };
        delete next[Number(route.id)];
        return next;
      });

      showMessage(
        response.data?.message ||
          "Araç simülasyonu başarıyla durduruldu."
      );
    } catch (error) {
      console.error("Araç simülasyonu durdurulamadı:", error);

      showMessage(
        getErrorMessage(
          error,
          "Araç simülasyonu durdurulurken hata oluştu."
        ),
        "error"
      );
    } finally {
      setSimulationActionRouteId(null);
    }
  };

  const saveStopOrder = async () => {
    if (
      !selectedRoute ||
      orderedStops.length === 0 ||
      !orderChanged
    ) {
      return;
    }

    try {
      setSavingOrder(true);

      await axios.put(
        `${API_BASE_URL}/api/TransitStops/reorder`,
        {
          transitRouteId: selectedRoute.id,
          stops: orderedStops.map((stop, index) => ({
            stopId: stop.id,
            orderNo: index + 1,
          })),
        },
        config
      );

      const updatedStops = orderedStops.map((stop, index) => ({
        ...stop,
        orderNo: index + 1,
      }));

      const routeWithUpdatedStops = {
        ...selectedRoute,
        stops: updatedStops,
        stopCount: updatedStops.length,
      };

      setOrderedStops(updatedStops);
      setSelectedRoute(routeWithUpdatedStops);

      setRoutes((currentRoutes) =>
        currentRoutes.map((route) =>
          route.id === selectedRoute.id
            ? routeWithUpdatedStops
            : route
        )
      );

      setOrderChanged(false);

      if (updatedStops.length >= 2) {
        await generateOsrmRoute(
          routeWithUpdatedStops,
          "Durak sırası kaydedildi ve OSRM rotası yeni sıraya göre güncellendi."
        );
      } else {
        showMessage(
          "Durak sıralaması kaydedildi. Rota oluşturmak için en az 2 durak gereklidir."
        );
      }
    } catch (error) {
      console.error("Durak sıralaması kaydedilemedi:", error);

      showMessage(
        getErrorMessage(
          error,
          "Durak sıralaması kaydedilirken hata oluştu."
        ),
        "error"
      );
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDeleteRoute = (route) => {
    setRouteToDelete(route);
  };

  const closeDeletePopup = () => {
    if (loading) {
      return;
    }

    setRouteToDelete(null);
  };

  const confirmDeleteRoute = async () => {
    if (!routeToDelete) {
      return;
    }

    const deletingRoute = routeToDelete;

    try {
      setLoading(true);

      await axios.delete(
        `${API_BASE_URL}/api/TransitRoutes/${deletingRoute.id}`,
        config
      );

      if (selectedRoute?.id === deletingRoute.id) {
        closeDetailModal();
      }

      if (editingRoute?.id === deletingRoute.id) {
        closeEditModal();
      }

      setRouteToDelete(null);

      showMessage(
        "Güzergah başarıyla silindi."
      );

      await loadRoutes();
    } catch (error) {
      console.error(
        "Güzergah silinemedi:",
        error
      );

      showMessage(
        getErrorMessage(
          error,
          "Güzergah silinirken hata oluştu."
        ),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "-";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString("tr-TR");
  };

  const totalStops = routes.reduce(
    (sum, route) => sum + Number(route.stopCount || route.stops?.length || 0),
    0
  );

  const activeRouteCount = routes.filter(
    (route) => route.isActive !== false
  ).length;

  return (
    <>
      <style>{`
        .transit-routes-fullpage * {
          box-sizing: border-box;
        }

        .transit-routes-fullpage button {
          transition:
            transform 120ms ease,
            filter 120ms ease,
            border-color 120ms ease,
            background 120ms ease;
        }

        .transit-routes-fullpage button:not(:disabled):hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        .transit-routes-fullpage input:focus {
          border-color: rgba(96,165,250,.65) !important;
          box-shadow: 0 0 0 3px rgba(37,99,235,.12);
        }

        @media (max-width: 980px) {
          .transit-route-row-card {
            grid-template-columns: minmax(220px, 1fr) 70px !important;
          }

          .transit-route-actions {
            grid-column: 1 / -1;
            max-width: 100% !important;
            grid-template-columns:
              repeat(5, minmax(82px, 1fr)) !important;
          }
        }

        @media (max-width: 700px) {
          .transit-route-row-card {
            grid-template-columns: 1fr !important;
          }

          .transit-route-actions {
            grid-template-columns:
              repeat(2, minmax(110px, 1fr)) !important;
          }
        }

        @media (max-width: 1120px) {
          .transit-route-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .transit-route-create-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 720px) {
          .transit-route-stat-grid,
          .transit-route-create-grid,
          .transit-route-filter-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div
      className="transit-routes-fullpage"
      style={panelOverlayStyle}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading && !savingOrder) {
          onClose?.();
        }
      }}
    >
      <div style={panelContainerStyle}>
        <div style={panelTopbarStyle}>
          <div>
            <div style={panelEyebrowStyle}>ULAŞIM MODÜLÜ</div>
            <div style={panelTopbarTitleStyle}>Güzergah Yönetimi</div>
            <div style={panelTopbarSubtitleStyle}>
              Hatları, durakları, OSRM rotalarını ve araç simülasyonlarını tek ekrandan yönet.
            </div>
          </div>

          <button
            type="button"
            aria-label="Güzergah yönetimini kapat"
            title="Kapat"
            onClick={() => onClose?.()}
            style={panelCloseButtonStyle}
            disabled={loading || savingOrder}
          >
            ×
          </button>
        </div>

        <div style={panelScrollStyle}>
          <div style={pageStyle}>
            <div className="transit-route-stat-grid" style={statisticsContainerStyle}>
              <div style={statisticCardStyle}>
                <div>
                  <span style={statisticLabelStyle}>Toplam Güzergah</span>
                  <strong style={statisticValueStyle}>{routes.length}</strong>
                </div>
                <span style={statisticIconBlue}>▤</span>
              </div>

              <div style={statisticCardStyle}>
                <div>
                  <span style={statisticLabelStyle}>Toplam Durak</span>
                  <strong style={statisticValueStyle}>{totalStops}</strong>
                </div>
                <span style={statisticIconGreen}>●</span>
              </div>

              <div style={statisticCardStyle}>
                <div>
                  <span style={statisticLabelStyle}>Aktif Güzergah</span>
                  <strong style={statisticValueStyle}>{activeRouteCount}</strong>
                </div>
                <span style={statisticIconPurple}>✓</span>
              </div>

              <div style={statisticCardStyle}>
                <div>
                  <span style={statisticLabelStyle}>Görüntülenen</span>
                  <strong style={statisticValueStyle}>{filteredRoutes.length}</strong>
                </div>
                <span style={statisticIconYellow}>⌁</span>
              </div>
            </div>

      {message && (
        <div
          style={{
            ...messageStyle,
            ...(messageType === "error"
              ? errorMessageStyle
              : successMessageStyle),
          }}
        >
          {message}
        </div>
      )}

      <form
        onSubmit={handleCreateRoute}
        style={filterCardStyle}
      >
        <h2 style={sectionTitleStyle}>
          Yeni Güzergah Ekle
        </h2>

        <div className="transit-route-create-grid" style={createGridStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>
              Güzergah adı
            </label>

            <input
              type="text"
              value={routeName}
              onChange={(event) =>
                setRouteName(event.target.value)
              }
              placeholder="Örnek: Üniversite - Merkez"
              style={inputStyle}
              disabled={loading}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>
              Kısa Kod
            </label>

            <input
              type="text"
              value={routeShortCode}
              onChange={(event)=>setRouteShortCode(event.target.value.toUpperCase())}
              placeholder="Örn: M5 / 34A"
              style={inputStyle}
              disabled={loading}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>
              Güzergah rengi
            </label>

            <div style={colorInputContainerStyle}>
              <input
                type="color"
                value={routeColor}
                onChange={(event) =>
                  setRouteColor(event.target.value)
                }
                style={colorInputStyle}
                disabled={loading}
              />

              <input
                type="text"
                value={routeColor}
                onChange={(event) =>
                  setRouteColor(event.target.value)
                }
                style={inputStyle}
                disabled={loading}
              />
            </div>
          </div>

          <div style={buttonContainerStyle}>
            <button
              type="submit"
              style={primaryButtonStyle}
              disabled={loading}
            >
              {loading
                ? "Kaydediliyor..."
                : "Güzergah Ekle"}
            </button>
          </div>
        </div>
      </form>

      <div style={filterCardStyle}>
        <div className="transit-route-filter-grid" style={filterGridStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>
              Güzergah ara
            </label>

            <input
              type="text"
              value={searchText}
              maxLength={70}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
              placeholder="Güzergah adı veya kısa kod..."
              style={searchInputStyle}
            />
          </div>

          <div style={filterButtonContainerStyle}>
            <button
              type="button"
              onClick={() =>
                setSearchText("")
              }
              style={secondaryButtonStyle}
            >
              Temizle
            </button>

            <button
              type="button"
              onClick={loadRoutes}
              style={primaryButtonStyle}
              disabled={loading}
            >
              {loading
                ? "Yükleniyor..."
                : "Yenile"}
            </button>
          </div>
        </div>
      </div>

      <div style={routeListCardStyle}>
        <div style={routeListHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Güzergahlar</h2>
            <div style={routeListSubtitleStyle}>
              Hat bilgileri ve temel işlemler
            </div>
          </div>

          <span style={tableCountStyle}>
            {filteredRoutes.length} kayıt
          </span>
        </div>

        <div style={routeCardsContainerStyle}>
          {loading && routes.length === 0 ? (
            <div style={emptyRouteListStyle}>
              Güzergahlar yükleniyor...
            </div>
          ) : filteredRoutes.length === 0 ? (
            <div style={emptyRouteListStyle}>
              Gösterilecek güzergah bulunamadı.
            </div>
          ) : (
            filteredRoutes.map((route) => {
              const simulation =
                simulationsByRouteId[Number(route.id)];

              const stopCount =
                Number(
                  route.stopCount ??
                    route.stops?.length ??
                    0
                );

              const canGenerateRoute =
                stopCount >= 2 &&
                generatingRouteId === null;

              const canStartSimulation =
                !simulation &&
                simulationActionRouteId === null &&
                Boolean(
                  route.hasGeneratedRoute ||
                    route.routeWkt
                ) &&
                stopCount >= 2;

              const canStopSimulation =
                Boolean(simulation) &&
                simulationActionRouteId === null;

              return (
                <div
                  key={route.id}
                  className="transit-route-row-card"
                  style={routeRowCardStyle}
                >
                  <div style={routeIdentityStyle}>
                    <div
                      style={{
                        ...routeCodeBadgeStyle,
                        borderColor:
                          route.color || "#2563eb",
                        color:
                          route.color || "#60a5fa",
                      }}
                    >
                      {route.shortCode || "—"}
                    </div>

                    <div style={routeNameBlockStyle}>
                      <strong style={routeNameStyle}>
                        {route.name}
                      </strong>

                    </div>
                  </div>

                  <div className="transit-route-meta-grid" style={routeMetaGridStyle}>
                    <div style={creatorCellStyle}>
                      <div style={creatorAvatarStyle}>
                        {route.creatorProfileImageUrl ? (
                          <img
                            src={getProfileImageUrl(
                              route.creatorProfileImageUrl
                            )}
                            alt={route.creatorUsername || "Kullanıcı"}
                            style={creatorAvatarImageStyle}
                          />
                        ) : (
                          <span style={creatorAvatarFallbackStyle}>
                            {getCreatorInitial(
                              route.creatorUsername
                            )}
                          </span>
                        )}
                      </div>

                      <div style={creatorTextStyle}>
                        <span style={routeMetaLabelStyle}>
                          Ekleyen
                        </span>
                        <strong style={creatorNameStyle}>
                          {route.creatorUsername || "—"}
                        </strong>
                      </div>
                    </div>

                    <div style={routeMetaItemStyle}>
                      <span style={routeMetaLabelStyle}>
                        Durak
                      </span>
                      <strong style={stopCountBadgeStyle}>
                        {stopCount} durak
                      </strong>
                    </div>
                  </div>

                  <div className="transit-route-actions" style={routeActionsStyle}>
                    <button
                      type="button"
                      onClick={() => openDetailModal(route)}
                      style={flatDetailButtonStyle}
                    >
                      Durakları Gör
                    </button>

                    <button
                      type="button"
                      onClick={() => generateOsrmRoute(route)}
                      style={{
                        ...flatRouteButtonStyle,
                        ...(!canGenerateRoute
                          ? disabledActionButtonStyle
                          : {}),
                      }}
                      disabled={!canGenerateRoute}
                    >
                      {Number(generatingRouteId) === Number(route.id)
                        ? "Oluşturuluyor..."
                        : route.hasGeneratedRoute || route.routeWkt
                          ? "Rotayı Güncelle"
                          : "Rota Oluştur"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        simulation
                          ? stopSimulation(route)
                          : startSimulation(route)
                      }
                      style={{
                        ...(simulation
                          ? flatStopButtonStyle
                          : flatSimulationButtonStyle),
                        ...(
                          simulation
                            ? !canStopSimulation
                            : !canStartSimulation
                        )
                          ? disabledActionButtonStyle
                          : {},
                      }}
                      disabled={
                        simulation
                          ? !canStopSimulation
                          : !canStartSimulation
                      }
                    >
                      {Number(simulationActionRouteId) === Number(route.id)
                        ? simulation
                          ? "Durduruluyor..."
                          : "Başlatılıyor..."
                        : simulation
                          ? "Durdur"
                          : "Simülasyonu Başlat"}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(route)}
                      style={flatEditButtonStyle}
                    >
                      Düzenle
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteRoute(route)}
                      style={flatDeleteButtonStyle}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedRoute && (
        <div
          style={modalOverlayStyle}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDetailModal();
            }
          }}
        >
          <div style={simpleModalStyle}>
            <div style={simpleModalHeaderStyle}>
              <div style={simpleModalTitleRowStyle}>
                <h2 style={simpleModalTitleStyle}>
                  {selectedRoute.name}
                </h2>

                <span
                  style={{
                    ...simpleRouteCodeStyle,
                    borderColor:
                      selectedRoute.color || "#2563eb",
                    color:
                      selectedRoute.color || "#7db7ff",
                  }}
                >
                  {selectedRoute.shortCode || "—"}
                </span>
              </div>

              <button
                type="button"
                onClick={closeDetailModal}
                style={simpleModalCloseStyle}
              >
                ×
              </button>
            </div>

            <div style={simpleStopsSectionStyle}>
              <div style={simpleStopsHeaderStyle}>
                <span style={simpleStopsTitleStyle}>
                  Duraklar
                </span>

                <span style={simpleStopsCountStyle}>
                  {orderedStops.length} durak
                </span>
              </div>

              <div style={simpleStopsListStyle}>
                {orderedStops.length === 0 ? (
                  <div style={simpleEmptyStopsStyle}>
                    Bu güzergaha henüz durak eklenmemiş.
                  </div>
                ) : (
                  orderedStops.map((stop, index) => (
                    <div
                      key={stop.id}
                      style={simpleStopRowStyle}
                    >
                      <span style={simpleStopOrderStyle}>
                        {index + 1}
                      </span>

                      <span style={simpleStopNameStyle}>
                        {stop.name}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={simpleModalFooterStyle}>
              <button
                type="button"
                onClick={() => {
                  closeDetailModal();
                  openEditModal(selectedRoute);
                }}
                style={simpleEditRouteButtonStyle}
              >
                Güzergahı Düzenle
              </button>

              <button
                type="button"
                onClick={closeDetailModal}
                style={simpleCloseButtonStyle}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {editingRoute && (
        <div
          style={modalOverlayStyle}
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeEditModal();
            }
          }}
        >
          <form
            onSubmit={handleUpdateRoute}
            style={modalStyle}
          >
            <div style={modalHeaderStyle}>
              <div>
                <span style={modalSubtitleStyle}>
                  Güzergah düzenleme
                </span>

                <h2 style={modalTitleStyle}>
                  {editingRoute.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                style={closeButtonStyle}
              >
                ×
              </button>
            </div>

            <div style={editFormGridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Güzergah adı
                </label>

                <input
                  type="text"
                  value={editName}
                  onChange={(event) =>
                    setEditName(
                      event.target.value
                    )
                  }
                  style={inputStyle}
                  disabled={loading}
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Kısa Kod
                </label>

                <input
                  type="text"
                  value={editShortCode}
                  onChange={(event) =>
                    setEditShortCode(
                      event.target.value.toUpperCase()
                    )
                  }
                  placeholder="Örn: M5 / 34A"
                  style={inputStyle}
                  disabled={loading}
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Güzergah rengi
                </label>

                <div style={colorInputContainerStyle}>
                  <input
                    type="color"
                    value={editColor}
                    onChange={(event) =>
                      setEditColor(
                        event.target.value
                      )
                    }
                    style={colorInputStyle}
                    disabled={loading}
                  />

                  <input
                    type="text"
                    value={editColor}
                    onChange={(event) =>
                      setEditColor(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                    disabled={loading}
                  />
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Durum
                </label>

                <select
                  value={
                    editIsActive
                      ? "true"
                      : "false"
                  }
                  onChange={(event) =>
                    setEditIsActive(
                      event.target.value ===
                        "true"
                    )
                  }
                  style={inputStyle}
                  disabled={loading}
                >
                  <option value="true">
                    Aktif
                  </option>

                  <option value="false">
                    Pasif
                  </option>
                </select>
              </div>
            </div>

            <div style={modalFooterStyle}>
              <button
                type="submit"
                style={primaryButtonStyle}
                disabled={loading}
              >
                {loading
                  ? "Kaydediliyor..."
                  : "Değişiklikleri Kaydet"}
              </button>

              <button
                type="button"
                onClick={closeEditModal}
                style={secondaryButtonStyle}
                disabled={loading}
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

            <AdminPopup
              open={Boolean(routeToDelete)}
              type="danger"
              title="Güzergah silinsin mi?"
              text={
                routeToDelete
                  ? `"${routeToDelete.name}" güzergahı ve bu güzergaha bağlı duraklar listeden kaldırılacak. Bu işlemi onaylıyor musun?`
                  : ""
              }
              confirmText="Güzergahı Sil"
              cancelText="Vazgeç"
              onClose={closeDeletePopup}
              onConfirm={confirmDeleteRoute}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

const getProfileImageUrl = (profileImageUrl) => {
  if (!profileImageUrl) {
    return "";
  }

  if (
    profileImageUrl.startsWith("http://") ||
    profileImageUrl.startsWith("https://")
  ) {
    return profileImageUrl;
  }

  const normalizedPath =
    profileImageUrl.startsWith("/")
      ? profileImageUrl
      : `/${profileImageUrl}`;

  return `${API_BASE_URL}${normalizedPath}`;
};

const getCreatorInitial = (username) => {
  const value = String(username || "").trim();

  return value
    ? value.charAt(0).toUpperCase()
    : "?";
};


const panelOverlayStyle = {
  position: "fixed",
  top: 64,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: 50000,
  pointerEvents: "auto",
  background: "#06172d",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const panelContainerStyle = {
  position: "absolute",
  inset: 0,
  width: "100%",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  pointerEvents: "auto",
  overflow: "hidden",
  background: "#06172d",
  border: "none",
  borderRadius: 0,
  boxShadow: "none",
};

const panelTopbarStyle = {
  minHeight: 60,
  padding: "0 clamp(16px, 2.2vw, 32px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  borderBottom: "1px solid rgba(69,112,160,0.18)",
  background: "#06172d",
  boxShadow: "0 5px 18px rgba(2,6,23,0.14)",
  flexShrink: 0,
};

const panelEyebrowStyle = {
  display: "none",
};

const panelTopbarTitleStyle = {
  color: "#f4f8fd",
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: "-.25px",
};

const panelTopbarSubtitleStyle = {
  marginTop: 2,
  color: "#8398b3",
  fontSize: 11,
  fontWeight: 500,
};

const panelCloseButtonStyle = {
  width: 38,
  height: 38,
  borderRadius: 9,
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(15,36,67,0.60)",
  color: "#ffffff",
  fontSize: 25,
  lineHeight: 1,
  cursor: "pointer",
};

const panelScrollStyle = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  padding: "14px clamp(16px, 2.2vw, 32px) 22px",
};

const statisticIconBase = {
  width: 34,
  height: 34,
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  fontWeight: 800,
};

const statisticIconBlue = {
  ...statisticIconBase,
  color: "#3191ff",
  background: "rgba(37,99,235,.18)",
};

const statisticIconGreen = {
  ...statisticIconBase,
  color: "#42d47c",
  background: "rgba(34,197,94,.14)",
};

const statisticIconPurple = {
  ...statisticIconBase,
  color: "#9b6cff",
  background: "rgba(124,58,237,.16)",
};

const statisticIconYellow = {
  ...statisticIconBase,
  color: "#f8c44f",
  background: "rgba(245,158,11,.14)",
};

const pageStyle = {
  width: "100%",
  maxWidth: 1320,
  minHeight: "100%",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  color: "#e8eef8",
  background: "transparent",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  flexWrap: "wrap",
};

const titleStyle = {
  margin: 0,
  fontSize: 30,
  fontWeight: 900,
  color: "#ffffff",
};

const descriptionStyle = {
  margin: "7px 0 0",
  maxWidth: 700,
  color: "#b9c8e3",
  fontSize: 14,
  lineHeight: 1.6,
};

const statisticsContainerStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(150px, 1fr))",
  gap: 10,
  width: "100%",
};

const statisticCardStyle = {
  minHeight: 72,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(76,111,150,0.20)",
  background: "#0a223f",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.02)",
};

const statisticLabelStyle = {
  display: "block",
  marginBottom: 7,
  color: "#a9bad0",
  fontSize: 12,
  fontWeight: 500, 
};

const statisticValueStyle = {
  display: "block",
  color: "#ffffff",
  fontSize: 25,
  fontWeight: 800,
  lineHeight: 1, 
};

const filterCardStyle = {
  padding: "10px 12px",
  borderRadius: 9,
  border: "1px solid rgba(76,111,150,0.16)",
  background: "#081f3a",
  boxShadow: "none",
};

const createGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "minmax(240px, 1.7fr) minmax(120px, .65fr) minmax(180px, .9fr) auto",
  alignItems: "end",
  gap: 10,
  marginTop: 10,
};

const filterGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 520px) auto",
  gap: 8,
  alignItems: "end",
  justifyContent: "start",
};

const fieldStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const labelStyle = {
  color: "#dce8ff",
  fontSize: 13,
  fontWeight: 750,
};

const inputStyle = {
  width: "100%",
  height: 38,
  padding: "0 11px",
  borderRadius: 7,
  border: "1px solid rgba(113,139,171,0.24)",
  outline: "none",
  boxSizing: "border-box",
  background: "#061a32",
  color: "#f4f8fd",
  fontSize: 12,
  fontFamily: "inherit",
};

const colorInputContainerStyle = {
  display: "grid",
  gridTemplateColumns: "54px 1fr",
  gap: 9,
};

const colorInputStyle = {
  width: 54,
  height: 42,
  padding: 3,
  borderRadius: 10,
  border: "1px solid rgba(148,163,184,0.28)",
  background: "rgba(15,23,42,0.88)",
  cursor: "pointer",
};

const buttonContainerStyle = {
  display: "flex",
  alignItems: "flex-end",
};

const filterButtonContainerStyle = {
  display: "flex",
  gap: 6,
  flexWrap: "nowrap",
  alignItems: "center",
};

const primaryButtonStyle = {
  minHeight: 40,
  padding: "0 17px",
  borderRadius: 7,
  border: "1px solid rgba(96,165,250,.38)",
  background: "linear-gradient(135deg,#1677ff,#2563eb)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 7px 18px rgba(37,99,235,.20)",
};

const secondaryButtonStyle = {
  minHeight: 41,
  padding: "9px 16px",
  border: "1px solid rgba(148,163,184,0.30)",
  borderRadius: 10,
  cursor: "pointer",
  color: "#dce8ff",
  fontWeight: 750,
  background: "rgba(30,41,59,0.80)",
};

const searchInputStyle = {
  ...inputStyle,
  width: "min(520px, 100%)",
  height: 34,
  fontSize: 11,
};

const routeListCardStyle = {
  padding: "12px 14px 14px",
  borderRadius: 10,
  border: "1px solid rgba(76,111,150,0.18)",
  background: "#081f3a",
};

const routeListHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  paddingBottom: 11,
  marginBottom: 4,
  borderBottom: "1px solid rgba(113,139,171,0.14)",
};

const routeListSubtitleStyle = {
  marginTop: 2,
  color: "#7288a3",
  fontSize: 11,
};

const routeCardsContainerStyle = {
  display: "flex",
  flexDirection: "column",
};

const routeRowCardStyle = {
  width: "100%",
  minWidth: 0,
  display: "grid",
  gridTemplateColumns:
    "minmax(230px, 300px) minmax(210px, 250px) minmax(520px, 1fr)",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 4px",
  borderBottom: "1px solid rgba(113,139,171,0.11)",
};

const routeIdentityStyle = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 9,
};

const routeCodeBadgeStyle = {
  width: 50,
  height: 34,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #2563eb",
  borderRadius: 8,
  background: "#071a32",
  fontSize: 11,
  fontWeight: 850,
};

const routeNameBlockStyle = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 0,
};

const routeNameStyle = {
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#f2f6fb",
  fontSize: 13,
  fontWeight: 750,
};

const routeIdStyle = {
  color: "#66809e",
  fontSize: 10,
  fontWeight: 700,
};

const routeMetaGridStyle = {
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "minmax(130px, 1fr) 84px",
  alignItems: "center",
  justifyContent: "start",
  gap: 14,
};

const routeMetaItemStyle = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const routeMetaLabelStyle = {
  color: "#6f86a3",
  fontSize: 9,
  fontWeight: 750,
  textTransform: "uppercase",
  letterSpacing: ".45px",
};

const routeMetaValueStyle = {
  color: "#dce7f5",
  fontSize: 12,
};

const routeMetaValueSmallStyle = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#c5d2e2",
  fontSize: 10,
  fontWeight: 650,
};

const compactSimulationStyle = {
  display: "flex",
  alignItems: "center",
  gap: 7,
};

const routeActionsStyle = {
  minWidth: 0,
  width: "100%",
  display: "grid",
  gridTemplateColumns:
    "minmax(92px, 1.15fr) minmax(102px, 1.1fr) minmax(126px, 1.35fr) 76px 52px",
  gap: 7,
  alignItems: "center",
  justifySelf: "end",
};

const creatorCellStyle = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 9,
};

const creatorAvatarStyle = {
  width: 30,
  height: 30,
  flexShrink: 0,
  overflow: "hidden",
  borderRadius: "50%",
  border: "1px solid rgba(143,171,205,.30)",
  background: "#102a48",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const creatorAvatarImageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const creatorAvatarFallbackStyle = {
  color: "#d7e6f7",
  fontSize: 11,
  fontWeight: 800,
};

const creatorTextStyle = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const creatorNameStyle = {
  maxWidth: 115,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#dbe7f4",
  fontSize: 11,
  fontWeight: 700,
};

const stopCountBadgeStyle = {
  width: "fit-content",
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(77,118,158,.18)",
  color: "#bfd2e5",
  fontSize: 10,
  fontWeight: 800,
};

const flatButtonBaseStyle = {
  minHeight: 30,
  padding: "5px 9px",
  borderRadius: 7,
  cursor: "pointer",
  fontSize: 9.5,
  lineHeight: 1.1,
  fontWeight: 800,
  whiteSpace: "nowrap",
  boxShadow: "none",
};

const flatDetailButtonStyle = {
  ...flatButtonBaseStyle,
  border: "1px solid rgba(83,124,165,.28)",
  background: "#123452",
  color: "#d5e3f2",
};

const flatRouteButtonStyle = {
  ...flatButtonBaseStyle,
  border: "1px solid rgba(65,116,166,.34)",
  background: "#1d4e7a",
  color: "#eef6ff",
};

const flatSimulationButtonStyle = {
  ...flatButtonBaseStyle,
  border: "1px solid rgba(55,130,103,.34)",
  background: "#17513e",
  color: "#e4f7ef",
};

const flatStopButtonStyle = {
  ...flatButtonBaseStyle,
  border: "1px solid rgba(151,81,91,.26)",
  background: "#4b2b34",
  color: "#f2d9df",
};

const flatEditButtonStyle = {
  ...flatButtonBaseStyle,
  border: "1px solid rgba(74,111,151,.24)",
  background: "#183756",
  color: "#d7e5f3",
};

const flatDeleteButtonStyle = {
  ...flatButtonBaseStyle,
  border: "1px solid rgba(145,76,85,.22)",
  background: "#40262f",
  color: "#efcbd1",
};

const compactButtonBaseStyle = {
  minHeight: 27,
  padding: "4px 6px",
  borderRadius: 5,
  cursor: "pointer",
  fontSize: 9,
  lineHeight: 1.05,
  fontWeight: 750,
  whiteSpace: "nowrap",
};

const compactNeutralButtonStyle = {
  ...compactButtonBaseStyle,
  border: "1px solid rgba(91,128,167,0.30)",
  background: "#0d3154",
  color: "#cde2f5",
};

const compactPrimaryButtonStyle = {
  ...compactButtonBaseStyle,
  border: "1px solid rgba(65,128,203,0.38)",
  background: "#174d86",
  color: "#e5f1ff",
};

const compactSuccessButtonStyle = {
  ...compactButtonBaseStyle,
  border: "1px solid rgba(65,151,117,0.34)",
  background: "#14513e",
  color: "#d8f5e9",
};

const compactDangerButtonStyle = {
  ...compactButtonBaseStyle,
  border: "1px solid rgba(173,91,99,0.30)",
  background: "#552a35",
  color: "#f2d6dc",
};

const compactEditButtonStyle = {
  ...compactButtonBaseStyle,
  border: "1px solid rgba(73,111,167,0.30)",
  background: "#17355f",
  color: "#d9e7fb",
};

const compactDeleteButtonStyle = {
  ...compactButtonBaseStyle,
  border: "1px solid rgba(157,80,91,0.30)",
  background: "#422431",
  color: "#efd5db",
};

const emptyRouteListStyle = {
  padding: "28px 10px",
  textAlign: "center",
  color: "#8196b0",
  fontSize: 12,
};

const tableCardStyle = {
  padding: "18px 20px 20px",
  borderRadius: 14,
  border: "1px solid rgba(96,165,250,0.16)",
  background:
    "linear-gradient(145deg, rgba(7,31,61,.94), rgba(5,24,49,.94))",
  boxShadow: "0 12px 32px rgba(2,6,23,.12)",
};

const tableTitleRowStyle = {
  marginBottom: 14,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const sectionTitleStyle = {
  margin: 0,
  color: "#ffffff",
  fontSize: 20,
  fontWeight: 850,
};

const tableCountStyle = {
  padding: "6px 10px",
  borderRadius: 999,
  color: "#bfdbfe",
  background: "rgba(37,99,235,0.17)",
  fontSize: 12,
  fontWeight: 800,
};

const tableWrapperStyle = {
  width: "100%",
  overflowX: "auto",
  borderTop: "1px solid rgba(148,163,184,.12)",
  borderRadius: "0 0 10px 10px",
};

const tableStyle = {
  width: "100%",
  minWidth: 1180,
  borderCollapse: "separate",
  borderSpacing: 0,
};

const thStyle = {
  padding: "13px 10px",
  color: "#aebed4",
  fontSize: 11,
  fontWeight: 800,
  textAlign: "left",
  whiteSpace: "nowrap",
  borderBottom: "1px solid rgba(148,163,184,.15)",
  background: "rgba(5,24,49,.98)",
  position: "sticky",
  top: 0,
  zIndex: 2,
};

const tdStyle = {
  padding: "15px 10px",
  color: "#eef4fb",
  fontSize: 12,
  borderBottom: "1px solid rgba(148,163,184,.09)",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

const emptyStyle = {
  ...tdStyle,
  textAlign: "center",
  padding: 35,
  color: "#aebbd3",
};

const routeColorCellStyle = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  whiteSpace: "nowrap",
};

const routeColorCircleStyle = {
  width: 18,
  height: 18,
  minWidth: 18,
  borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.80)",
  boxShadow: "0 3px 10px rgba(0,0,0,0.30)",
};

const countBadgeStyle = {
  display: "inline-flex",
  padding: "5px 10px",
  borderRadius: 999,
  color: "#bae6fd",
  background: "rgba(14,165,233,0.16)",
  fontWeight: 800,
  fontSize: 12,
};

const statusBadgeStyle = {
  display: "inline-flex",
  padding: "5px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
};

const activeBadgeStyle = {
  color: "#bbf7d0",
  background: "rgba(22,163,74,0.20)",
};

const passiveBadgeStyle = {
  color: "#fecaca",
  background: "rgba(220,38,38,0.20)",
};

const actionRowStyle = {
  minWidth: 340,
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(96px, 1fr))",
  gap: 7,
  alignItems: "stretch",
};

const detailButtonStyle = {
  border: "none",
  cursor: "pointer",
  background: "rgba(14,165,233,0.18)",
  color: "#bae6fd",
  fontWeight: 750,
  minHeight: 34,
  padding: "6px 9px",
  borderRadius: 8,
  fontSize: 11,
  lineHeight: 1.15,
  whiteSpace: "normal",
};

const routeButtonStyle = {
  border: "1px solid rgba(34,197,94,0.28)",
  cursor: "pointer",
  background:
    "linear-gradient(135deg, rgba(22,163,74,0.88), rgba(21,128,61,0.88))",
  color: "#dcfce7",
  fontWeight: 750,
  minHeight: 34,
  padding: "6px 9px",
  borderRadius: 8,
  fontSize: 11,
  lineHeight: 1.15,
  whiteSpace: "normal",
};

const disabledActionButtonStyle = {
  opacity: 0.48,
  cursor: "not-allowed",
};

const simulationStartButtonStyle = {
  border: "1px solid rgba(34,197,94,0.34)",
  cursor: "pointer",
  background:
    "linear-gradient(135deg, rgba(22,163,74,0.92), rgba(21,128,61,0.92))",
  color: "#dcfce7",
  fontWeight: 750,
  minHeight: 34,
  padding: "6px 9px",
  borderRadius: 8,
  fontSize: 11,
  lineHeight: 1.15,
  whiteSpace: "normal",
};

const simulationStopButtonStyle = {
  border: "1px solid rgba(248,113,113,0.32)",
  cursor: "pointer",
  background:
    "linear-gradient(135deg, rgba(185,28,28,0.86), rgba(153,27,27,0.86))",
  color: "#fee2e2",
  fontWeight: 750,
  minHeight: 34,
  padding: "6px 9px",
  borderRadius: 8,
  fontSize: 11,
  lineHeight: 1.15,
  whiteSpace: "normal",
};

const simulationStatusContainerStyle = {
  minWidth: 118,
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: 6,
};

const simulationRunningBadgeStyle = {
  display: "inline-flex",
  padding: "4px 7px",
  borderRadius: 999,
  color: "#bbf7d0",
  background: "rgba(22,163,74,0.20)",
  fontSize: 10,
  fontWeight: 800,
};

const simulationStoppedBadgeStyle = {
  display: "inline-flex",
  padding: "5px 8px",
  borderRadius: 999,
  color: "#cbd5e1",
  background: "rgba(100,116,139,0.20)",
  fontSize: 10,
  fontWeight: 800,
};

const simulationProgressTrackStyle = {
  width: 52,
  height: 6,
  overflow: "hidden",
  borderRadius: 999,
  background: "rgba(148,163,184,0.20)",
};

const simulationProgressBarStyle = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, #22c55e, #4ade80)",
  transition: "width 0.35s ease",
};

const simulationProgressTextStyle = {
  color: "#bbf7d0",
  fontSize: 10,
  fontWeight: 800,
};

const editButtonStyle = {
  border: "none",
  cursor: "pointer",
  background: "rgba(37,99,235,0.22)",
  color: "#dbeafe",
  fontWeight: 750,
  minHeight: 34,
  padding: "6px 9px",
  borderRadius: 8,
  fontSize: 11,
  lineHeight: 1.15,
  whiteSpace: "normal",
};

const deleteButtonStyle = {
  border: "none",
  cursor: "pointer",
  background: "rgba(220,38,38,0.20)",
  color: "#fecaca",
  fontWeight: 750,
  minHeight: 34,
  padding: "6px 9px",
  borderRadius: 8,
  fontSize: 11,
  lineHeight: 1.15,
  whiteSpace: "normal",
};

const messageStyle = {
  padding: "12px 15px",
  borderRadius: 11,
  fontSize: 14,
  fontWeight: 750,
};

const successMessageStyle = {
  color: "#bbf7d0",
  background: "rgba(22,163,74,0.18)",
  border: "1px solid rgba(34,197,94,0.26)",
};

const errorMessageStyle = {
  color: "#fecaca",
  background: "rgba(220,38,38,0.18)",
  border: "1px solid rgba(239,68,68,0.26)",
};

const simpleModalStyle = {
  width: "min(620px, calc(100vw - 32px))",
  maxHeight: "calc(100vh - 120px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  borderRadius: 14,
  border: "1px solid rgba(91,125,160,.26)",
  background: "#081d36",
  boxShadow: "0 24px 70px rgba(0,0,0,.42)",
};

const simpleModalHeaderStyle = {
  minHeight: 64,
  padding: "14px 18px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  borderBottom: "1px solid rgba(111,140,171,.14)",
};

const simpleModalTitleRowStyle = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const simpleModalTitleStyle = {
  margin: 0,
  color: "#f2f7fc",
  fontSize: 20,
  fontWeight: 800,
  lineHeight: 1.15,
};

const simpleRouteCodeStyle = {
  minWidth: 42,
  height: 28,
  padding: "0 10px",
  border: "1px solid #2563eb",
  borderRadius: 7,
  background: "#0b2744",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 850,
};

const simpleModalCloseStyle = {
  width: 34,
  height: 34,
  flexShrink: 0,
  borderRadius: 8,
  border: "1px solid rgba(111,140,171,.24)",
  background: "#102944",
  color: "#dbe7f3",
  cursor: "pointer",
  fontSize: 22,
  lineHeight: 1,
};

const simpleStopsSectionStyle = {
  minHeight: 0,
  padding: "16px 18px 6px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const simpleStopsHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const simpleStopsTitleStyle = {
  color: "#b9cadb",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: ".55px",
};

const simpleStopsCountStyle = {
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(77,118,158,.16)",
  color: "#bfd2e5",
  fontSize: 10,
  fontWeight: 800,
};

const simpleStopsListStyle = {
  maxHeight: "380px",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 7,
  paddingRight: 3,
};

const simpleStopRowStyle = {
  minHeight: 44,
  padding: "8px 10px",
  display: "flex",
  alignItems: "center",
  gap: 10,
  borderRadius: 8,
  border: "1px solid rgba(103,133,164,.14)",
  background: "#0b2541",
};

const simpleStopOrderStyle = {
  width: 28,
  height: 28,
  flexShrink: 0,
  borderRadius: 7,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#173a5d",
  color: "#dbe9f7",
  fontSize: 11,
  fontWeight: 850,
};

const simpleStopNameStyle = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#eef4fb",
  fontSize: 13,
  fontWeight: 700,
};

const simpleEmptyStopsStyle = {
  padding: "24px 12px",
  textAlign: "center",
  color: "#8196ad",
  fontSize: 12,
};

const simpleModalFooterStyle = {
  padding: "14px 18px 18px",
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  borderTop: "1px solid rgba(111,140,171,.12)",
};

const simpleEditRouteButtonStyle = {
  minHeight: 36,
  padding: "0 14px",
  borderRadius: 7,
  border: "1px solid rgba(66,118,168,.32)",
  background: "#1b4a74",
  color: "#eef6ff",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 800,
};

const simpleCloseButtonStyle = {
  minHeight: 36,
  padding: "0 14px",
  borderRadius: 7,
  border: "1px solid rgba(104,129,157,.24)",
  background: "#132c47",
  color: "#d7e3ef",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 800,
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  background: "rgba(2,6,23,0.76)",
  backdropFilter: "blur(7px)",
};

const modalStyle = {
  width: "min(680px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  padding: 22,
  borderRadius: 18,
  background: "rgba(8,18,55,0.98)",
  border: "1px solid rgba(96,165,250,0.26)",
  boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
};

const modalHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 20,
  marginBottom: 20,
};

const modalSubtitleStyle = {
  color: "#93c5fd",
  fontSize: 12,
  fontWeight: 850,
  textTransform: "uppercase",
  letterSpacing: 1,
};

const modalTitleStyle = {
  margin: "5px 0 0",
  color: "#ffffff",
  fontSize: 25,
  fontWeight: 900,
};

const closeButtonStyle = {
  width: 36,
  height: 36,
  border: "1px solid rgba(148,163,184,0.24)",
  borderRadius: 10,
  cursor: "pointer",
  background: "rgba(15,23,42,0.84)",
  color: "#ffffff",
  fontSize: 24,
  lineHeight: 1,
};

const routeSummaryStyle = {
  marginBottom: 15,
  padding: 13,
  borderRadius: 12,
  background: "rgba(15,31,67,0.72)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const stopsContainerStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 9,
};

const stopItemStyle = {
  padding: 12,
  borderRadius: 11,
  background: "rgba(15,31,67,0.72)",
  border: "1px solid rgba(148,163,184,0.12)",
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const stopOrderStyle = {
  width: 32,
  height: 32,
  minWidth: 32,
  borderRadius: 9,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#ffffff",
  background:
    "linear-gradient(135deg, #2563eb, #4f46e5)",
  fontWeight: 900,
};

const stopInfoStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  color: "#ffffff",
};

const stopIdStyle = {
  color: "#aebbd3",
  fontSize: 11,
};

const emptyStopsStyle = {
  padding: 25,
  borderRadius: 12,
  textAlign: "center",
  color: "#aebbd3",
  background: "rgba(15,31,67,0.55)",
};

const dragHelpStyle = {
  marginBottom: 12,
  padding: "10px 12px",
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  gap: 9,
  color: "#bfdbfe",
  background: "rgba(37,99,235,0.12)",
  border: "1px solid rgba(96,165,250,0.18)",
  fontSize: 12,
  lineHeight: 1.5,
};

const dragHelpIconStyle = {
  fontSize: 18,
  fontWeight: 900,
  color: "#60a5fa",
};

const dragHandleStyle = {
  width: 24,
  color: "#94a3b8",
  fontSize: 17,
  fontWeight: 900,
  cursor: "grab",
  userSelect: "none",
};

const draggedStopItemStyle = {
  opacity: 0.48,
  transform: "scale(0.985)",
  border: "1px dashed rgba(96,165,250,0.65)",
};

const saveOrderButtonStyle = {
  minHeight: 41,
  padding: "9px 16px",
  border: "1px solid rgba(34,197,94,0.32)",
  borderRadius: 10,
  cursor: "pointer",
  color: "#dcfce7",
  fontWeight: 850,
  background:
    "linear-gradient(135deg, rgba(22,163,74,0.88), rgba(21,128,61,0.88))",
};

const disabledOrderButtonStyle = {
  opacity: 0.48,
  cursor: "not-allowed",
};

const editFormGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 15,
};

const modalFooterStyle = {
  marginTop: 21,
  paddingTop: 17,
  borderTop: "1px solid rgba(148,163,184,0.13)",
  display: "flex",
  justifyContent: "flex-end",
  gap: 9,
  flexWrap: "wrap",
};

export default TransitRoutesPanel;