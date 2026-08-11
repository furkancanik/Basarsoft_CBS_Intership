import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE_URL = "http://localhost:5075";

const panelStyle = {
  position: "absolute",
  top: 72,
  left: 18,
  zIndex: 4100,
  width: "min(1080px, calc(100vw - 36px))",
  maxHeight: "calc(100vh - 92px)",
  overflow: "hidden",
  borderRadius: 18,
  border: "1px solid rgba(96,165,250,.28)",
  background: "linear-gradient(145deg, rgba(2,12,28,.985), rgba(7,30,62,.98))",
  color: "#e2e8f0",
  boxShadow: "0 24px 70px rgba(2,6,23,.48)",
  fontFamily: 'Inter, "Segoe UI", sans-serif',
};

const inputStyle = {
  width: "100%",
  height: 38,
  boxSizing: "border-box",
  marginTop: 6,
  borderRadius: 9,
  border: "1px solid rgba(148,163,184,.24)",
  background: "rgba(15,23,42,.72)",
  color: "#f8fafc",
  padding: "0 11px",
  outline: "none",
};

const buttonStyle = {
  minHeight: 36,
  border: "1px solid rgba(96,165,250,.28)",
  borderRadius: 9,
  background: "rgba(30,64,175,.72)",
  color: "#eff6ff",
  padding: "8px 13px",
  cursor: "pointer",
  fontWeight: 700,
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

function TripManagementPanel({ transitRoutes = [], onClose }) {
  const authConfig = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    }),
    []
  );

  const routes = useMemo(
    () =>
      (Array.isArray(transitRoutes) ? transitRoutes : []).map((item) => ({
        id: Number(item.id ?? item.Id),
        name: item.name ?? item.Name ?? "İsimsiz güzergah",
        shortCode: item.shortCode ?? item.ShortCode ?? "",
      })),
    [transitRoutes]
  );

  const [activeTab, setActiveTab] = useState("trips");
  const [schedules, setSchedules] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const [scheduleForm, setScheduleForm] = useState({
    transitRouteId: "",
    name: "Hafta İçi",
    validFrom: today,
    validTo: "",
    runsMonday: true,
    runsTuesday: true,
    runsWednesday: true,
    runsThursday: true,
    runsFriday: true,
    runsSaturday: false,
    runsSunday: false,
  });

  const [tripForm, setTripForm] = useState({
    transitRouteId: "",
    transitScheduleId: "",
    tripCode: "",
    vehicleType: "Bus",
    departureTime: "08:00",
    stopDwellSeconds: 10,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [scheduleResponse, tripResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/transit-trips/schedules`, authConfig),
        axios.get(`${API_BASE_URL}/api/transit-trips`, authConfig),
      ]);

      setSchedules(
        Array.isArray(scheduleResponse.data) ? scheduleResponse.data : []
      );
      setTrips(Array.isArray(tripResponse.data) ? tripResponse.data : []);
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Sefer bilgileri yüklenemedi.")
      );
    } finally {
      setLoading(false);
    }
  }, [authConfig]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!tripForm.transitRouteId && routes.length > 0) {
      const firstId = String(routes[0].id);

      setTripForm((current) => ({
        ...current,
        transitRouteId: firstId,
      }));

      setScheduleForm((current) => ({
        ...current,
        transitRouteId: firstId,
      }));
    }
  }, [routes, tripForm.transitRouteId]);

  const routeSchedules = schedules.filter(
    (item) =>
      Number(item.transitRouteId ?? item.TransitRouteId) ===
      Number(tripForm.transitRouteId)
  );

  useEffect(() => {
    if (
      routeSchedules.length > 0 &&
      !routeSchedules.some(
        (item) =>
          String(item.id ?? item.Id) ===
          String(tripForm.transitScheduleId)
      )
    ) {
      setTripForm((current) => ({
        ...current,
        transitScheduleId: String(
          routeSchedules[0].id ?? routeSchedules[0].Id
        ),
      }));
    }
  }, [routeSchedules, tripForm.transitScheduleId]);

  const createSchedule = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setMessage("");

      await axios.post(
        `${API_BASE_URL}/api/transit-trips/schedules`,
        {
          ...scheduleForm,
          transitRouteId: Number(scheduleForm.transitRouteId),
          validFrom: new Date(
            `${scheduleForm.validFrom}T00:00:00`
          ).toISOString(),
          validTo: scheduleForm.validTo
            ? new Date(`${scheduleForm.validTo}T00:00:00`).toISOString()
            : null,
        },
        authConfig
      );

      setMessage("Sefer takvimi oluşturuldu.");
      await loadData();
      setActiveTab("trips");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Takvim oluşturulamadı."));
    } finally {
      setSaving(false);
    }
  };

  const createTrip = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setMessage("");

      await axios.post(
        `${API_BASE_URL}/api/transit-trips`,
        {
          transitRouteId: Number(tripForm.transitRouteId),
          transitScheduleId: Number(tripForm.transitScheduleId),
          tripCode: tripForm.tripCode,
          vehicleType: tripForm.vehicleType,
          departureTime: tripForm.departureTime,
          stopDwellSeconds: Number(tripForm.stopDwellSeconds),
        },
        authConfig
      );

      setMessage("Sefer oluşturuldu.");
      setTripForm((current) => ({ ...current, tripCode: "" }));
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Sefer oluşturulamadı."));
    } finally {
      setSaving(false);
    }
  };

  const deleteTrip = async (tripId) => {
    if (!window.confirm("Bu sefer silinsin mi?")) {
      return;
    }

    try {
      setError("");
      setMessage("");

      await axios.delete(
        `${API_BASE_URL}/api/transit-trips/${tripId}`,
        authConfig
      );

      setMessage("Sefer silindi.");
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Sefer silinemedi."));
    }
  };

  const updateTripActive = async (trip, isActive) => {
    const tripId = trip.id ?? trip.Id;

    try {
      setError("");
      setMessage("");

      await axios.put(
        `${API_BASE_URL}/api/transit-trips/${tripId}`,
        {
          transitScheduleId:
            trip.transitScheduleId ?? trip.TransitScheduleId,
          tripCode: trip.tripCode ?? trip.TripCode,
          vehicleType: trip.vehicleType ?? trip.VehicleType,
          departureTime: String(
            trip.departureTime ?? trip.DepartureTime ?? "08:00"
          ).slice(0, 5),
          isActive,
          stopDwellSeconds: 10,
        },
        authConfig
      );

      setMessage(
        isActive ? "Sefer aktifleştirildi." : "Sefer pasifleştirildi."
      );
      await loadData();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Sefer durumu güncellenemedi.")
      );
    }
  };

  const dayFields = [
    ["runsMonday", "Pzt"],
    ["runsTuesday", "Sal"],
    ["runsWednesday", "Çar"],
    ["runsThursday", "Per"],
    ["runsFriday", "Cum"],
    ["runsSaturday", "Cmt"],
    ["runsSunday", "Paz"],
  ];

  return (
    <section style={panelStyle}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 18px",
          borderBottom: "1px solid rgba(148,163,184,.16)",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
            Sefer Yönetimi
          </div>
          <div style={{ marginTop: 3, fontSize: 12, color: "#94a3b8" }}>
            Takvim ve güzergah bazlı sefer kayıtları
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{ ...buttonStyle, background: "rgba(51,65,85,.65)" }}
        >
          Kapat
        </button>
      </header>

      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "12px 18px",
          borderBottom: "1px solid rgba(148,163,184,.13)",
        }}
      >
        {[
          ["trips", "Seferler"],
          ["newTrip", "Yeni Sefer"],
          ["schedules", "Yeni Takvim"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            style={{
              ...buttonStyle,
              background:
                activeTab === key
                  ? "rgba(37,99,235,.9)"
                  : "rgba(30,41,59,.72)",
            }}
          >
            {label}
          </button>
        ))}

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          style={{
            ...buttonStyle,
            marginLeft: "auto",
            background: "rgba(14,116,144,.72)",
          }}
        >
          {loading ? "Yükleniyor..." : "Yenile"}
        </button>
      </div>

      {(error || message) && (
        <div
          style={{
            margin: "12px 18px 0",
            padding: "10px 12px",
            borderRadius: 9,
            background: error
              ? "rgba(127,29,29,.5)"
              : "rgba(6,78,59,.5)",
            color: error ? "#fecaca" : "#a7f3d0",
          }}
        >
          {error || message}
        </div>
      )}

      <div
        style={{
          padding: 18,
          overflow: "auto",
          maxHeight: "calc(100vh - 220px)",
        }}
      >
        {activeTab === "trips" && (
          <div style={{ display: "grid", gap: 10 }}>
            {trips.length === 0 ? (
              <div
                style={{
                  color: "#94a3b8",
                  padding: 24,
                  textAlign: "center",
                }}
              >
                Henüz sefer bulunmuyor.
              </div>
            ) : (
              trips.map((trip) => {
                const id = trip.id ?? trip.Id;
                const active = trip.isActive ?? trip.IsActive;

                return (
                  <article
                    key={id}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "100px 1.4fr 1fr 120px auto",
                      gap: 12,
                      alignItems: "center",
                      padding: 13,
                      borderRadius: 12,
                      border: "1px solid rgba(148,163,184,.16)",
                      background: "rgba(15,23,42,.58)",
                    }}
                  >
                    <strong style={{ color: "#bfdbfe" }}>
                      {trip.routeShortCode ?? trip.RouteShortCode ?? "-"}
                    </strong>

                    <div>
                      <div style={{ fontWeight: 750 }}>
                        {trip.routeName ?? trip.RouteName}
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>
                        {trip.scheduleName ?? trip.ScheduleName}
                      </div>
                    </div>

                    <div>
                      <div>{trip.tripCode ?? trip.TripCode}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>
                        {trip.vehicleType ?? trip.VehicleType} ·{" "}
                        {(trip.departureTime ?? trip.DepartureTime ?? "").slice(
                          0,
                          5
                        )}
                      </div>
                    </div>

                    <span
                      style={{
                        color: active ? "#86efac" : "#fca5a5",
                        fontWeight: 700,
                      }}
                    >
                      {active ? "Aktif" : "Pasif"}
                    </span>

                    <div
                      style={{
                        display: "flex",
                        gap: 7,
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => updateTripActive(trip, !active)}
                        style={{
                          ...buttonStyle,
                          background: active
                            ? "rgba(180,83,9,.72)"
                            : "rgba(5,150,105,.72)",
                        }}
                      >
                        {active ? "Pasifleştir" : "Aktifleştir"}
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteTrip(id)}
                        style={{
                          ...buttonStyle,
                          background: "rgba(185,28,28,.72)",
                        }}
                      >
                        Sil
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}

        {activeTab === "newTrip" && (
          <form
            onSubmit={createTrip}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            <label>
              Güzergah
              <select
                required
                value={tripForm.transitRouteId}
                onChange={(event) =>
                  setTripForm((current) => ({
                    ...current,
                    transitRouteId: event.target.value,
                    transitScheduleId: "",
                  }))
                }
                style={inputStyle}
              >
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.shortCode ? `${route.shortCode} - ` : ""}
                    {route.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Takvim
              <select
                required
                value={tripForm.transitScheduleId}
                onChange={(event) =>
                  setTripForm((current) => ({
                    ...current,
                    transitScheduleId: event.target.value,
                  }))
                }
                style={inputStyle}
              >
                <option value="">Takvim seç</option>
                {routeSchedules.map((item) => (
                  <option key={item.id ?? item.Id} value={item.id ?? item.Id}>
                    {item.name ?? item.Name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Sefer kodu
              <input
                required
                value={tripForm.tripCode}
                onChange={(event) =>
                  setTripForm((current) => ({
                    ...current,
                    tripCode: event.target.value,
                  }))
                }
                placeholder="Örn. M2-0800"
                style={inputStyle}
              />
            </label>

            <label>
              Araç tipi
              <select
                value={tripForm.vehicleType}
                onChange={(event) =>
                  setTripForm((current) => ({
                    ...current,
                    vehicleType: event.target.value,
                  }))
                }
                style={inputStyle}
              >
                <option value="Bus">Otobüs</option>
                <option value="Metro">Metro</option>
              </select>
            </label>

            <label>
              Kalkış saati
              <input
                type="time"
                required
                value={tripForm.departureTime}
                onChange={(event) =>
                  setTripForm((current) => ({
                    ...current,
                    departureTime: event.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>

            <label>
              Durak bekleme süresi
              <input
                type="number"
                min="0"
                max="600"
                value={tripForm.stopDwellSeconds}
                onChange={(event) =>
                  setTripForm((current) => ({
                    ...current,
                    stopDwellSeconds: event.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>

            <button
              disabled={saving || !tripForm.transitScheduleId}
              type="submit"
              style={{
                ...buttonStyle,
                gridColumn: "1 / -1",
                minHeight: 42,
              }}
            >
              {saving ? "Kaydediliyor..." : "Sefer Oluştur"}
            </button>
          </form>
        )}

        {activeTab === "schedules" && (
          <form
            onSubmit={createSchedule}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            <label>
              Güzergah
              <select
                required
                value={scheduleForm.transitRouteId}
                onChange={(event) =>
                  setScheduleForm((current) => ({
                    ...current,
                    transitRouteId: event.target.value,
                  }))
                }
                style={inputStyle}
              >
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.shortCode ? `${route.shortCode} - ` : ""}
                    {route.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Takvim adı
              <input
                required
                value={scheduleForm.name}
                onChange={(event) =>
                  setScheduleForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>

            <label>
              Başlangıç tarihi
              <input
                type="date"
                required
                value={scheduleForm.validFrom}
                onChange={(event) =>
                  setScheduleForm((current) => ({
                    ...current,
                    validFrom: event.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>

            <label>
              Bitiş tarihi
              <input
                type="date"
                value={scheduleForm.validTo}
                onChange={(event) =>
                  setScheduleForm((current) => ({
                    ...current,
                    validTo: event.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>

            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                flexWrap: "wrap",
                gap: 9,
              }}
            >
              {dayFields.map(([fieldName, label]) => (
                <label
                  key={fieldName}
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    padding: "8px 10px",
                    background: "rgba(15,23,42,.7)",
                    borderRadius: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={scheduleForm[fieldName]}
                    onChange={(event) =>
                      setScheduleForm((current) => ({
                        ...current,
                        [fieldName]: event.target.checked,
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>

            <button
              disabled={saving}
              type="submit"
              style={{
                ...buttonStyle,
                gridColumn: "1 / -1",
                minHeight: 42,
              }}
            >
              {saving ? "Kaydediliyor..." : "Takvim Oluştur"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export default TripManagementPanel;
