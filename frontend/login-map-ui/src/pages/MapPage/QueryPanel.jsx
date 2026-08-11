import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL, getAuthConfig } from "./api";

function QueryPanel({ onSelectGeometry }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("CreatedDate");
  const [desc, setDesc] = useState(true);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchGeometries = async () => {
    try {
      setLoading(true);

      const response = await axios.get(`${API_BASE_URL}/api/geometry/query`, {
        ...getAuthConfig(),
        params: {
          name: name || null,
          type: type || "All",
          startDate: startDate || null,
          endDate: endDate || null,
          sortBy:
            sortBy === "CreatedDate"
              ? "createdDate"
              : sortBy === "Name"
              ? "name"
              : "type",
          sortDirection: desc ? "desc" : "asc",
        },
      });

      setResults(response.data);
    } catch (error) {
      console.log("Sorgulama hatası:", error);

      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        return;
      }

      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchGeometries();
  }, []);

  return (
    <div style={styles.panel}>
      <div style={styles.title}>Çizim Sorgulama</div>

      <input
        style={styles.input}
        placeholder="İsme göre ara..."
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div style={styles.row}>
        <select
          style={styles.select}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="All">Tümü</option>
          <option value="Point">Point</option>
          <option value="Line">Line</option>
          <option value="Polygon">Polygon</option>
        </select>

        <select
          style={styles.select}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="CreatedDate">Eklenme Tarihi</option>
          <option value="Name">İsim</option>
          <option value="Type">Tür</option>
        </select>
      </div>

      <div style={styles.dateLabelRow}>
        <span>Başlangıç Tarihi</span>
        <span>Bitiş Tarihi</span>
      </div>

      <div style={styles.row}>
        <input
          type="date"
          style={styles.inputNoMargin}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        <input
          type="date"
          style={styles.inputNoMargin}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      <button onClick={() => setDesc(!desc)} style={styles.sortButton}>
        Sıralama: {desc ? "Azalan" : "Artan"}
      </button>

      <button onClick={searchGeometries} style={styles.searchButton}>
        {loading ? "Aranıyor..." : "Ara"}
      </button>

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <span>Tür</span>
          <span>İsim</span>
          <span>Eklenme Tarihi</span>
        </div>

        {loading ? (
          <div style={styles.empty}>
            <div style={styles.emptyTitle}>Aranıyor...</div>
          </div>
        ) : results.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyTitle}>
              Bu filtreye uygun çizim bulunamadı.
            </div>
            <div style={styles.emptyText}>
              Filtreleri değiştirip tekrar deneyin.
            </div>
          </div>
        ) : (
          results.map((item, index) => (
            <div
              key={`${item.type}-${item.id}-${index}`}
              style={styles.tableRow}
              onClick={() => onSelectGeometry(item)}
              title="Haritada göster"
            >
              <span>{item.type}</span>
              <span>{item.name}</span>
              <span>
                {new Date(item.createdDate).toLocaleDateString("tr-TR")}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  panel: {
    position: "absolute",
    top: "92px",
    right: "20px",
    zIndex: 1500,
    width: "430px",
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(15, 23, 42, 0.96)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 22px 55px rgba(0,0,0,.38)",
    color: "white",
  },

  title: {
    fontSize: "18px",
    fontWeight: "900",
    marginBottom: "14px",
    textAlign: "center",
  },

  input: {
    width: "100%",
    height: "38px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.25)",
    background: "#1f2937",
    color: "white",
    padding: "0 12px",
    marginBottom: "10px",
    boxSizing: "border-box",
    outline: "none",
  },

  inputNoMargin: {
    width: "100%",
    height: "38px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.25)",
    background: "#1f2937",
    color: "white",
    padding: "0 12px",
    boxSizing: "border-box",
    outline: "none",
  },

  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "10px",
  },

  dateLabelRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "6px",
    padding: "0 4px",
    color: "#93c5fd",
    fontSize: "12px",
    fontWeight: "800",
  },

  select: {
    height: "38px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.25)",
    background: "#1f2937",
    color: "white",
    padding: "0 10px",
    outline: "none",
  },

  sortButton: {
    width: "100%",
    height: "38px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.25)",
    background: "#1f2937",
    color: "white",
    fontWeight: "700",
    cursor: "pointer",
    marginBottom: "10px",
  },

  searchButton: {
    width: "100%",
    height: "40px",
    borderRadius: "10px",
    border: "none",
    background: "#2563eb",
    color: "white",
    fontSize: "15px",
    fontWeight: "900",
    cursor: "pointer",
    marginBottom: "14px",
  },

  table: {
    maxHeight: "260px",
    overflowY: "auto",
    borderRadius: "12px",
    border: "1px solid rgba(148,163,184,0.20)",
  },

  tableHeader: {
    display: "grid",
    gridTemplateColumns: "90px 1fr 130px",
    gap: "8px",
    padding: "10px",
    background: "rgba(255,255,255,0.08)",
    fontSize: "13px",
    fontWeight: "900",
    color: "#93c5fd",
  },

  tableRow: {
    display: "grid",
    gridTemplateColumns: "90px 1fr 130px",
    gap: "8px",
    padding: "10px",
    borderTop: "1px solid rgba(148,163,184,0.15)",
    fontSize: "13px",
    fontWeight: "700",
    color: "#e5e7eb",
    cursor: "pointer",
  },

  empty: {
    padding: "22px 14px",
    textAlign: "center",
    color: "#cbd5e1",
    borderTop: "1px solid rgba(148,163,184,0.15)",
  },

  emptyTitle: {
    fontSize: "14px",
    fontWeight: "800",
    color: "#e5e7eb",
    marginBottom: "4px",
  },

  emptyText: {
    fontSize: "12px",
    color: "#94a3b8",
    fontWeight: "600",
  },
};

export default QueryPanel;