import { useEffect, useRef, useState } from "react";
import axios from "axios";

import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Draw from "ol/interaction/Draw";
import WKT from "ol/format/WKT";
import { fromLonLat } from "ol/proj";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";

function GeographicAuthorizationsPage() {
  const API_BASE_URL = "http://localhost:5075";
  const token = localStorage.getItem("token");

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const mapRef = useRef(null);
  const mapObjectRef = useRef(null);
  const sourceRef = useRef(null);
  const drawRef = useRef(null);
  const selectedFeatureRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [areas, setAreas] = useState([]);
  const [targetType, setTargetType] = useState("user");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [currentWkt, setCurrentWkt] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
    initMap();

    return () => {
      if (drawRef.current && mapObjectRef.current) {
        mapObjectRef.current.removeInteraction(drawRef.current);
      }

      if (mapObjectRef.current) {
        mapObjectRef.current.setTarget(undefined);
      }
    };
  }, []);

  const areaStyle = new Style({
    stroke: new Stroke({
      color: "#38bdf8",
      width: 3,
    }),
    fill: new Fill({
      color: "rgba(56,189,248,0.18)",
    }),
  });

  const loadInitialData = async () => {
    try {
      setLoading(true);

      const [usersRes, rolesRes, areasRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/users`, config),
        axios.get(`${API_BASE_URL}/api/roles`, config),
        axios.get(`${API_BASE_URL}/api/geographicauthorizations`, config),
      ]);

      setUsers(usersRes.data);
      setRoles(rolesRes.data);
      setAreas(areasRes.data);
    } catch (error) {
      console.error("Coğrafi yetki verileri alınamadı:", error);
      alert("Coğrafi yetki verileri alınırken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const getAreas = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/geographicauthorizations`,
        config
      );

      setAreas(response.data);
    } catch (error) {
      console.error("Coğrafi yetkiler alınamadı:", error);
    }
  };

  const initMap = () => {
    const source = new VectorSource();
    sourceRef.current = source;

    const vectorLayer = new VectorLayer({
      source,
      style: areaStyle,
    });

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat([35, 39]),
        zoom: 5.6,
        minZoom: 4,
        maxZoom: 18,
      }),
    });

    mapObjectRef.current = map;

    setTimeout(() => {
      map.updateSize();
    }, 100);
  };

  const startDrawArea = () => {
    if (!mapObjectRef.current || !sourceRef.current) return;

    if (drawRef.current) {
      mapObjectRef.current.removeInteraction(drawRef.current);
    }

    sourceRef.current.clear();
    setCurrentWkt("");
    selectedFeatureRef.current = null;

    const draw = new Draw({
      source: sourceRef.current,
      type: "Polygon",
    });

    draw.on("drawend", (event) => {
      selectedFeatureRef.current = event.feature;

      const writer = new WKT();
      const wkt = writer.writeFeature(event.feature, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });

      setCurrentWkt(wkt);
      mapObjectRef.current.removeInteraction(draw);
      drawRef.current = null;
    });

    drawRef.current = draw;
    mapObjectRef.current.addInteraction(draw);
  };

  const clearDraw = () => {
    if (drawRef.current && mapObjectRef.current) {
      mapObjectRef.current.removeInteraction(drawRef.current);
      drawRef.current = null;
    }

    sourceRef.current?.clear();
    setCurrentWkt("");
    selectedFeatureRef.current = null;
  };

  const saveArea = async () => {
    if (!currentWkt) {
      alert("Önce haritada bir alan çiziniz.");
      return;
    }

    if (targetType === "user" && !selectedUserId) {
      alert("Lütfen bir kullanıcı seçiniz.");
      return;
    }

    if (targetType === "role" && !selectedRoleId) {
      alert("Lütfen bir rol seçiniz.");
      return;
    }

    const body = {
      userId: targetType === "user" ? Number(selectedUserId) : null,
      roleId: targetType === "role" ? Number(selectedRoleId) : null,
      wkt: currentWkt,
    };

    try {
      await axios.post(
        `${API_BASE_URL}/api/geographicauthorizations`,
        body,
        config
      );

      alert("Coğrafi yetki başarıyla kaydedildi.");
      clearDraw();
      await getAreas();
    } catch (error) {
      console.error("Coğrafi yetki kaydedilemedi:", error);
      alert("Coğrafi yetki kaydedilirken bir hata oluştu.");
    }
  };

  const deleteArea = async (id) => {
    if (!window.confirm("Bu coğrafi yetki silinsin mi?")) return;

    try {
      await axios.delete(
        `${API_BASE_URL}/api/geographicauthorizations/${id}`,
        config
      );

      await getAreas();
    } catch (error) {
      console.error("Coğrafi yetki silinemedi:", error);
      alert("Coğrafi yetki silinirken bir hata oluştu.");
    }
  };

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.header}>
        <div>
          <h1 style={pageStyles.title}>Coğrafi Yetki Yönetimi</h1>
          <p style={pageStyles.subtitle}>
            Kullanıcı veya role ait çizim sınırını harita üzerinden belirleyin.
          </p>
        </div>

        <div
          style={{
            ...pageStyles.drawStatus,
            ...(currentWkt
              ? pageStyles.drawStatusReady
              : pageStyles.drawStatusEmpty),
          }}
        >
          {currentWkt ? "Alan çizildi" : "Henüz alan çizilmedi"}
        </div>
      </div>

      <section style={pageStyles.mapCard}>
        <div style={pageStyles.mapHeader}>
          <div>
            <h2 style={pageStyles.sectionTitle}>Yetki Alanı Haritası</h2>
            <p style={pageStyles.sectionText}>
              Alan Çiz butonuna bastıktan sonra harita üzerinde sınırı oluşturun.
            </p>
          </div>
        </div>

        <div style={pageStyles.mapWrapper}>
          <div ref={mapRef} style={pageStyles.map} />
        </div>
      </section>

      <div style={pageStyles.bottomGrid}>
        <section style={pageStyles.assignmentCard}>
          <div style={pageStyles.cardHeader}>
            <h2 style={pageStyles.sectionTitle}>Yetki Ataması</h2>
            <p style={pageStyles.sectionText}>
              Çizilen alanı kullanıcıya veya role atayın.
            </p>
          </div>

          <div style={pageStyles.typeSelector}>
            <button
              type="button"
              style={{
                ...pageStyles.typeButton,
                ...(targetType === "user" ? pageStyles.typeButtonActive : {}),
              }}
              onClick={() => {
                setTargetType("user");
                setSelectedRoleId("");
              }}
            >
              Kullanıcıya Ver
            </button>

            <button
              type="button"
              style={{
                ...pageStyles.typeButton,
                ...(targetType === "role" ? pageStyles.typeButtonActive : {}),
              }}
              onClick={() => {
                setTargetType("role");
                setSelectedUserId("");
              }}
            >
              Role Ver
            </button>
          </div>

          <div style={pageStyles.fieldGroup}>
            <label style={pageStyles.label}>
              {targetType === "user" ? "Kullanıcı" : "Rol"}
            </label>

            {targetType === "user" ? (
              <select
                style={pageStyles.select}
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
              >
                <option value="">Kullanıcı seçiniz</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
            ) : (
              <select
                style={pageStyles.select}
                value={selectedRoleId}
                onChange={(event) => setSelectedRoleId(event.target.value)}
              >
                <option value="">Rol seçiniz</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={pageStyles.actionGroup}>
            <button
              type="button"
              style={pageStyles.drawButton}
              onClick={startDrawArea}
            >
              Alan Çiz
            </button>

            <button
              type="button"
              style={pageStyles.saveButton}
              onClick={saveArea}
            >
              Kaydet
            </button>

            <button
              type="button"
              style={pageStyles.clearButton}
              onClick={clearDraw}
            >
              Temizle
            </button>
          </div>
        </section>

        <section style={pageStyles.listCard}>
          <div style={pageStyles.cardHeader}>
            <h2 style={pageStyles.sectionTitle}>Mevcut Coğrafi Yetkiler</h2>
            <p style={pageStyles.sectionText}>
              Toplam {areas.length} coğrafi yetki bulunuyor.
            </p>
          </div>

          {loading ? (
            <div style={pageStyles.emptyState}>
              Coğrafi yetkiler yükleniyor...
            </div>
          ) : areas.length === 0 ? (
            <div style={pageStyles.emptyState}>
              Henüz coğrafi yetki bulunmuyor.
            </div>
          ) : (
            <div style={pageStyles.areaList}>
              {areas.map((area) => (
                <div key={area.id} style={pageStyles.areaRow}>
                  <div style={pageStyles.areaInfo}>
                    <span style={pageStyles.areaId}>#{area.id}</span>

                    <span
                      style={{
                        ...pageStyles.areaTypeBadge,
                        ...(area.userId
                          ? pageStyles.userBadge
                          : pageStyles.roleBadge),
                      }}
                    >
                      {area.userId ? "Kullanıcı" : "Rol"}
                    </span>

                    <span style={pageStyles.areaName}>
                      {area.userId ? area.username : area.roleName}
                    </span>
                  </div>

                  <button
                    type="button"
                    style={pageStyles.deleteButton}
                    onClick={() => deleteArea(area.id)}
                  >
                    Sil
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const pageStyles = {
  page: {
    width: "100%",
    height: "calc(100vh - 48px)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    color: "#ffffff",
    overflow: "hidden",
  },

  header: {
    minHeight: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },

  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: "-0.7px",
  },

  subtitle: {
    margin: "4px 0 0",
    color: "#9fb0cc",
    fontSize: 11,
    fontWeight: 600,
  },

  drawStatus: {
    flexShrink: 0,
    padding: "6px 11px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 800,
  },

  drawStatusEmpty: {
    color: "#bfdbfe",
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(96,165,250,0.25)",
  },

  drawStatusReady: {
    color: "#86efac",
    background: "rgba(34,197,94,0.14)",
    border: "1px solid rgba(34,197,94,0.28)",
  },

  mapCard: {
    width: "100%",
    flex: "0 0 360px",
    padding: 12,
    borderRadius: 15,
    background: "rgba(8,18,55,0.76)",
    border: "1px solid rgba(96,165,250,0.2)",
    boxShadow: "0 14px 34px rgba(0,0,0,0.22)",
  },

  mapHeader: {
    marginBottom: 8,
  },

  sectionTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 900,
  },

  sectionText: {
    margin: "3px 0 0",
    color: "#9fb0cc",
    fontSize: 10,
    fontWeight: 600,
  },

  mapWrapper: {
    width: "100%",
    height: 305,
    overflow: "hidden",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.2)",
  },

  map: {
    width: "100%",
    height: "100%",
  },

  bottomGrid: {
    flex: 1,
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "minmax(300px, 0.75fr) minmax(0, 1.65fr)",
    gap: 10,
  },

  assignmentCard: {
    minHeight: 0,
    padding: 14,
    borderRadius: 15,
    background: "rgba(8,18,55,0.78)",
    border: "1px solid rgba(96,165,250,0.2)",
  },

  listCard: {
    minHeight: 0,
    padding: 14,
    borderRadius: 15,
    background: "rgba(8,18,55,0.78)",
    border: "1px solid rgba(96,165,250,0.2)",
    overflow: "hidden",
  },

  cardHeader: {
    marginBottom: 10,
  },

  typeSelector: {
    display: "flex",
    gap: 7,
    marginBottom: 10,
  },

  typeButton: {
    minHeight: 34,
    padding: "7px 11px",
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.2)",
    background: "rgba(15,31,67,0.7)",
    color: "#9fb0cc",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 800,
  },

  typeButtonActive: {
    border: "1px solid rgba(96,165,250,0.5)",
    background: "rgba(37,99,235,0.24)",
    color: "#ffffff",
  },

  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    marginBottom: 10,
  },

  label: {
    color: "#dce8ff",
    fontSize: 10,
    fontWeight: 800,
  },

  select: {
    width: "100%",
    height: 36,
    padding: "7px 10px",
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.26)",
    outline: "none",
    background: "rgba(15,23,42,0.9)",
    color: "#ffffff",
    fontSize: 10,
  },

  actionGroup: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 7,
  },

  drawButton: {
    minHeight: 34,
    borderRadius: 8,
    border: "1px solid rgba(96,165,250,0.42)",
    background: "rgba(37,99,235,0.24)",
    color: "#bfdbfe",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 800,
  },

  saveButton: {
    minHeight: 34,
    borderRadius: 8,
    border: "1px solid rgba(34,197,94,0.32)",
    background: "rgba(22,163,74,0.2)",
    color: "#86efac",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 800,
  },

  clearButton: {
    minHeight: 34,
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.24)",
    background: "rgba(51,65,85,0.52)",
    color: "#cbd5e1",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 800,
  },

  areaList: {
    height: "calc(100% - 42px)",
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 7,
    overflowY: "auto",
    paddingRight: 3,
  },

  areaRow: {
    minHeight: 50,
    padding: "8px 9px",
    borderRadius: 10,
    background: "rgba(15,31,67,0.76)",
    border: "1px solid rgba(96,165,250,0.14)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  areaInfo: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 7,
  },

  areaId: {
    color: "#9fb0cc",
    fontSize: 9,
    fontWeight: 800,
  },

  areaTypeBadge: {
    flexShrink: 0,
    padding: "3px 6px",
    borderRadius: 999,
    fontSize: 8,
    fontWeight: 800,
  },

  userBadge: {
    color: "#93c5fd",
    background: "rgba(59,130,246,0.14)",
    border: "1px solid rgba(59,130,246,0.24)",
  },

  roleBadge: {
    color: "#c4b5fd",
    background: "rgba(139,92,246,0.14)",
    border: "1px solid rgba(139,92,246,0.24)",
  },

  areaName: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 800,
  },

  deleteButton: {
    flexShrink: 0,
    minHeight: 27,
    padding: "5px 8px",
    borderRadius: 7,
    border: "1px solid rgba(248,113,113,0.34)",
    background: "rgba(127,29,29,0.16)",
    color: "#fca5a5",
    cursor: "pointer",
    fontSize: 9,
    fontWeight: 800,
  },

  emptyState: {
    height: "calc(100% - 42px)",
    minHeight: 90,
    borderRadius: 11,
    background: "rgba(15,31,67,0.58)",
    border: "1px dashed rgba(96,165,250,0.18)",
    color: "#9fb0cc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    fontSize: 10,
    fontWeight: 700,
  },
};

export default GeographicAuthorizationsPage;
