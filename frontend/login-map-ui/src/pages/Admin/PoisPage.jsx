import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import AdminPopup from "./AdminPopup";

const API_BASE_URL = "http://localhost:5075";

function PoisPage() {
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const [selectedPoi, setSelectedPoi] = useState(null);
  const [editingPoi, setEditingPoi] = useState(null);
  const [poiToDelete, setPoiToDelete] = useState(null);

  const [categories, setCategories] = useState([]);
  const [editName, setEditName] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editOpeningTime, setEditOpeningTime] = useState("");
  const [editClosingTime, setEditClosingTime] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const token = localStorage.getItem("token");

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
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

  const loadPois = async () => {
    try {
      setLoading(true);

      const response = await axios.get(
        `${API_BASE_URL}/api/Pois`,
        config
      );

      setPois(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("POI kayıtları alınamadı:", error);

      showMessage(
        getErrorMessage(
          error,
          "POI kayıtları yüklenirken hata oluştu."
        ),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/PoiCategories`,
        config
      );

      setCategories(
        Array.isArray(response.data) ? response.data : []
      );
    } catch (error) {
      console.error("Kategoriler alınamadı:", error);
    }
  };

  useEffect(() => {
    loadPois();
    loadCategories();
  }, []);

  const activeSubCategories = useMemo(() => {
    return categories.filter(
      (category) =>
        category.parentId !== null &&
        category.parentId !== undefined &&
        category.isActive
    );
  }, [categories]);

  const categoryOptions = useMemo(() => {
    const names = pois
      .map((poi) => poi.categoryName)
      .filter(Boolean);

    return [...new Set(names)].sort((a, b) =>
      a.localeCompare(b, "tr")
    );
  }, [pois]);

  const filteredPois = useMemo(() => {
    const normalizedSearch = searchText
      .trim()
      .toLocaleLowerCase("tr-TR");

    return pois.filter((poi) => {
      const matchesSearch =
        !normalizedSearch ||
        poi.name
          ?.toLocaleLowerCase("tr-TR")
          .includes(normalizedSearch) ||
        poi.username
          ?.toLocaleLowerCase("tr-TR")
          .includes(normalizedSearch) ||
        poi.categoryName
          ?.toLocaleLowerCase("tr-TR")
          .includes(normalizedSearch) ||
        poi.parentCategoryName
          ?.toLocaleLowerCase("tr-TR")
          .includes(normalizedSearch);

      const matchesCategory =
        !selectedCategory ||
        poi.categoryName === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [pois, searchText, selectedCategory]);

  const getProfileImageSrc = (profileImageUrl) => {
    if (!profileImageUrl) {
      return "";
    }

    const imageUrl = String(profileImageUrl).trim();

    if (!imageUrl) {
      return "";
    }

    if (
      imageUrl.startsWith("http://") ||
      imageUrl.startsWith("https://") ||
      imageUrl.startsWith("data:")
    ) {
      return imageUrl;
    }

    return `${API_BASE_URL}${
      imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`
    }`;
  };

  const normalizeTime = (timeValue) => {
    if (!timeValue) {
      return "-";
    }

    return String(timeValue).slice(0, 5);
  };

  const normalizeTimeForInput = (timeValue) => {
    if (!timeValue) {
      return "";
    }

    return String(timeValue).slice(0, 5);
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

  const openDetailModal = (poi) => {
    setSelectedPoi(poi);
  };

  const closeDetailModal = () => {
    setSelectedPoi(null);
  };

  const openEditModal = (poi) => {
    setEditingPoi(poi);

    setEditName(poi.name ?? "");
    setEditCategoryId(
      poi.poiCategoryId ? String(poi.poiCategoryId) : ""
    );
    setEditOpeningTime(
      normalizeTimeForInput(poi.openingTime)
    );
    setEditClosingTime(
      normalizeTimeForInput(poi.closingTime)
    );
    setEditIsActive(poi.isActive ?? true);
  };

  const closeEditModal = () => {
    setEditingPoi(null);
    setEditName("");
    setEditCategoryId("");
    setEditOpeningTime("");
    setEditClosingTime("");
    setEditIsActive(true);
  };

  const handleUpdatePoi = async (event) => {
    event.preventDefault();

    if (!editingPoi) {
      return;
    }

    if (!editName.trim()) {
      showMessage("POI adı boş olamaz.", "error");
      return;
    }

    if (!editCategoryId) {
      showMessage("Alt kategori seçmelisin.", "error");
      return;
    }

    if (!editOpeningTime || !editClosingTime) {
      showMessage(
        "Açılış ve kapanış saatlerini seçmelisin.",
        "error"
      );
      return;
    }

    try {
      setLoading(true);

      await axios.put(
        `${API_BASE_URL}/api/Pois/${editingPoi.id}`,
        {
          name: editName.trim(),
          poiCategoryId: Number(editCategoryId),
          openingTime: `${editOpeningTime}:00`,
          closingTime: `${editClosingTime}:00`,
          wkt: editingPoi.wkt,
          isActive: editIsActive,
        },
        config
      );

      closeEditModal();

      showMessage("POI başarıyla güncellendi.");

      await loadPois();
    } catch (error) {
      console.error("POI güncellenemedi:", error);

      showMessage(
        getErrorMessage(
          error,
          "POI güncellenirken hata oluştu."
        ),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePoi = (poi) => {
    setPoiToDelete(poi);
  };

  const closeDeletePopup = () => {
    if (loading) {
      return;
    }

    setPoiToDelete(null);
  };

  const confirmDeletePoi = async () => {
    if (!poiToDelete) {
      return;
    }

    const deletingPoi = poiToDelete;

    try {
      setLoading(true);

      await axios.delete(
        `${API_BASE_URL}/api/Pois/${deletingPoi.id}`,
        config
      );

      if (selectedPoi?.id === deletingPoi.id) {
        closeDetailModal();
      }

      if (editingPoi?.id === deletingPoi.id) {
        closeEditModal();
      }

      setPoiToDelete(null);
      showMessage("POI başarıyla silindi.");

      await loadPois();
    } catch (error) {
      console.error("POI silinemedi:", error);

      showMessage(
        getErrorMessage(
          error,
          "POI silinirken hata oluştu."
        ),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>POI Yönetimi</h1>

          <p style={descriptionStyle}>
            Haritaya eklenen POI kayıtlarını, kategorilerini,
            mesai saatlerini ve ekleyen kullanıcıları görüntüleyebilirsin.
          </p>
        </div>

        <div style={statisticsContainerStyle}>
          <div style={statisticCardStyle}>
            <span style={statisticLabelStyle}>
              Toplam POI
            </span>

            <strong style={statisticValueStyle}>
              {pois.length}
            </strong>
          </div>

          <div style={statisticCardStyle}>
            <span style={statisticLabelStyle}>
              Görüntülenen
            </span>

            <strong style={statisticValueStyle}>
              {filteredPois.length}
            </strong>
          </div>
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

      <div style={filterCardStyle}>
        <div style={filterGridStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>
              POI ara
            </label>

            <input
              type="text"
              value={searchText}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
              placeholder="İsim, kategori veya kullanıcı ara..."
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>
              Kategori filtresi
            </label>

            <select
              value={selectedCategory}
              onChange={(event) =>
                setSelectedCategory(event.target.value)
              }
              style={inputStyle}
            >
              <option value="">Tüm kategoriler</option>

              {categoryOptions.map((categoryName) => (
                <option
                  key={categoryName}
                  value={categoryName}
                >
                  {categoryName}
                </option>
              ))}
            </select>
          </div>

          <div style={filterButtonContainerStyle}>
            <button
              type="button"
              onClick={() => {
                setSearchText("");
                setSelectedCategory("");
              }}
              style={secondaryButtonStyle}
            >
              Filtreleri Temizle
            </button>

            <button
              type="button"
              onClick={loadPois}
              style={primaryButtonStyle}
              disabled={loading}
            >
              {loading ? "Yükleniyor..." : "Yenile"}
            </button>
          </div>
        </div>
      </div>

      <div style={tableCardStyle}>
        <div style={tableTitleRowStyle}>
          <h2 style={sectionTitleStyle}>
            Eklenen POI Listesi
          </h2>

          <span style={tableCountStyle}>
            {filteredPois.length} kayıt
          </span>
        </div>

        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                                <th style={thStyle}>POI adı</th>
                <th style={thStyle}>Ana kategori</th>
                <th style={thStyle}>Alt kategori</th>
                <th style={thStyle}>Mesai saatleri</th>
                <th style={thStyle}>Ekleyen</th>
                <th style={thStyle}>Eklenme tarihi</th>
                <th style={thStyle}>Durum</th>
                <th style={thStyle}>İşlemler</th>
              </tr>
            </thead>

            <tbody>
              {loading && pois.length === 0 ? (
                <tr>
                  <td colSpan="8" style={emptyStyle}>
                    POI kayıtları yükleniyor...
                  </td>
                </tr>
              ) : filteredPois.length === 0 ? (
                <tr>
                  <td colSpan="8" style={emptyStyle}>
                    Gösterilecek POI kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredPois.map((poi) => (
                  <tr key={poi.id}>
                    <td style={tdStyle}>
                      <strong>{poi.name}</strong>
                    </td>

                    <td style={tdStyle}>
                      {poi.parentCategoryName ?? "-"}
                    </td>

                    <td style={tdStyle}>
                      {poi.categoryName ?? "-"}
                    </td>

                    <td style={tdStyle}>
                      <span style={timeBadgeStyle}>
                        {normalizeTime(poi.openingTime)}
                        {" - "}
                        {normalizeTime(poi.closingTime)}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      <div style={userCellStyle}>
                        <span style={userAvatarStyle}>
                          <span style={userAvatarFallbackStyle}>
                            {poi.username
                              ?.charAt(0)
                              .toUpperCase() ?? "?"}
                          </span>

                          {poi.profileImageUrl && (
                            <img
                              src={getProfileImageSrc(
                                poi.profileImageUrl
                              )}
                              alt={`${
                                poi.username ?? "Kullanıcı"
                              } profil fotoğrafı`}
                              style={userAvatarImageStyle}
                              onError={(event) => {
                                event.currentTarget.style.display =
                                  "none";
                              }}
                            />
                          )}
                        </span>

                        <span>
                          {poi.username ?? "Bilinmiyor"}
                        </span>
                      </div>
                    </td>

                    <td style={tdStyle}>
                      {formatDate(poi.createdDate)}
                    </td>

                    <td style={tdStyle}>
                      <span
                        style={{
                          ...statusBadgeStyle,
                          ...(poi.isActive
                            ? activeBadgeStyle
                            : passiveBadgeStyle),
                        }}
                      >
                        {poi.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      <div style={actionRowStyle}>
                        <button
                          type="button"
                          onClick={() =>
                            openDetailModal(poi)
                          }
                          style={detailButtonStyle}
                        >
                          Detay
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openEditModal(poi)
                          }
                          style={editButtonStyle}
                        >
                          Düzenle
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDeletePoi(poi)
                          }
                          style={deleteButtonStyle}
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPoi && (
        <div
          style={modalOverlayStyle}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDetailModal();
            }
          }}
        >
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <span style={modalSubtitleStyle}>
                  POI bilgileri
                </span>

                <h2 style={modalTitleStyle}>
                  {selectedPoi.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeDetailModal}
                style={closeButtonStyle}
              >
                ×
              </button>
            </div>

            <div style={detailGridStyle}>
              <DetailItem
                label="Ana kategori"
                value={
                  selectedPoi.parentCategoryName ?? "-"
                }
              />

              <DetailItem
                label="Alt kategori"
                value={selectedPoi.categoryName ?? "-"}
              />

              <DetailItem
                label="Açılış saati"
                value={normalizeTime(
                  selectedPoi.openingTime
                )}
              />

              <DetailItem
                label="Kapanış saati"
                value={normalizeTime(
                  selectedPoi.closingTime
                )}
              />

              <DetailItem
                label="Ekleyen kullanıcı"
                value={selectedPoi.username ?? "-"}
              />

              <DetailItem
                label="Eklenme tarihi"
                value={formatDate(
                  selectedPoi.createdDate
                )}
              />

              <DetailItem
                label="Son güncelleme"
                value={formatDate(
                  selectedPoi.modifiedDate
                )}
              />

              <DetailItem
                label="Durum"
                value={
                  selectedPoi.isActive
                    ? "Aktif"
                    : "Pasif"
                }
              />
            </div>

            <div style={wktContainerStyle}>
              <span style={detailLabelStyle}>
                Konum WKT
              </span>

              <div style={wktStyle}>
                {selectedPoi.wkt ?? "-"}
              </div>
            </div>

            <div style={modalFooterStyle}>
              <button
                type="button"
                onClick={() => {
                  closeDetailModal();
                  openEditModal(selectedPoi);
                }}
                style={primaryButtonStyle}
              >
                Düzenle
              </button>

              <button
                type="button"
                onClick={closeDetailModal}
                style={secondaryButtonStyle}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPoi && (
        <div
          style={modalOverlayStyle}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditModal();
            }
          }}
        >
          <form
            onSubmit={handleUpdatePoi}
            style={modalStyle}
          >
            <div style={modalHeaderStyle}>
              <div>
                <span style={modalSubtitleStyle}>
                  POI düzenleme
                </span>

                <h2 style={modalTitleStyle}>
                  {editingPoi.name}
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
                  POI adı
                </label>

                <input
                  type="text"
                  value={editName}
                  onChange={(event) =>
                    setEditName(event.target.value)
                  }
                  style={inputStyle}
                  disabled={loading}
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Alt kategori
                </label>

                <select
                  value={editCategoryId}
                  onChange={(event) =>
                    setEditCategoryId(event.target.value)
                  }
                  style={inputStyle}
                  disabled={loading}
                >
                  <option value="">
                    Alt kategori seç
                  </option>

                  {activeSubCategories.map(
                    (category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.parentName
                          ? `${category.parentName} > `
                          : ""}
                        {category.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Açılış saati
                </label>

                <input
                  type="time"
                  value={editOpeningTime}
                  onChange={(event) =>
                    setEditOpeningTime(
                      event.target.value
                    )
                  }
                  style={inputStyle}
                  disabled={loading}
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Kapanış saati
                </label>

                <input
                  type="time"
                  value={editClosingTime}
                  onChange={(event) =>
                    setEditClosingTime(
                      event.target.value
                    )
                  }
                  style={inputStyle}
                  disabled={loading}
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Durum
                </label>

                <select
                  value={
                    editIsActive ? "true" : "false"
                  }
                  onChange={(event) =>
                    setEditIsActive(
                      event.target.value === "true"
                    )
                  }
                  style={inputStyle}
                  disabled={loading}
                >
                  <option value="true">Aktif</option>
                  <option value="false">Pasif</option>
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
        open={Boolean(poiToDelete)}
        type="danger"
        title="POI kaydı silinsin mi?"
        text={
          poiToDelete
            ? `"${poiToDelete.name}" isimli POI kaydı kalıcı olarak listeden kaldırılacak. Bu işlemi onaylıyor musun?`
            : ""
        }
        confirmText="POI'yi Sil"
        cancelText="Vazgeç"
        onClose={closeDeletePopup}
        onConfirm={confirmDeletePoi}
        loading={loading}
      />
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div style={detailItemStyle}>
      <span style={detailLabelStyle}>
        {label}
      </span>

      <strong style={detailValueStyle}>
        {value}
      </strong>
    </div>
  );
}

const pageStyle = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 20,
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
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const statisticCardStyle = {
  minWidth: 135,
  padding: "13px 17px",
  borderRadius: 14,
  background: "rgba(15,31,67,0.84)",
  border: "1px solid rgba(96,165,250,0.22)",
  display: "flex",
  flexDirection: "column",
  gap: 3,
};

const statisticLabelStyle = {
  color: "#aebbd3",
  fontSize: 12,
};

const statisticValueStyle = {
  color: "#ffffff",
  fontSize: 24,
};

const filterCardStyle = {
  padding: 19,
  borderRadius: 16,
  background: "rgba(8,18,55,0.86)",
  border: "1px solid rgba(96,165,250,0.20)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.23)",
  backdropFilter: "blur(14px)",
};

const filterGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "minmax(220px, 2fr) minmax(200px, 1fr) auto",
  gap: 14,
  alignItems: "end",
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
  minHeight: 42,
  padding: "10px 12px",
  borderRadius: 10,
  outline: "none",
  border: "1px solid rgba(148,163,184,0.28)",
  background: "rgba(15,23,42,0.88)",
  color: "#ffffff",
};

const filterButtonContainerStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const primaryButtonStyle = {
  minHeight: 41,
  padding: "9px 16px",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  color: "#ffffff",
  fontWeight: 800,
  background:
    "linear-gradient(135deg, #2563eb, #4f46e5)",
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

const tableCardStyle = {
  padding: 20,
  borderRadius: 17,
  background: "rgba(8,18,55,0.86)",
  border: "1px solid rgba(96,165,250,0.20)",
  boxShadow: "0 20px 45px rgba(0,0,0,0.24)",
  overflow: "hidden",
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
};

const tableStyle = {
  width: "100%",
  minWidth: 1200,
  borderCollapse: "collapse",
};

const thStyle = {
  padding: "13px 11px",
  textAlign: "left",
  color: "#e5efff",
  fontSize: 12,
  whiteSpace: "nowrap",
  borderBottom: "1px solid rgba(148,163,184,0.16)",
};

const tdStyle = {
  padding: "13px 11px",
  color: "#e7efff",
  fontSize: 13,
  borderBottom: "1px solid rgba(148,163,184,0.10)",
  verticalAlign: "middle",
};

const emptyStyle = {
  ...tdStyle,
  textAlign: "center",
  padding: 35,
  color: "#aebbd3",
};

const timeBadgeStyle = {
  display: "inline-flex",
  padding: "6px 9px",
  borderRadius: 8,
  background: "rgba(14,165,233,0.14)",
  color: "#bae6fd",
  fontWeight: 750,
  whiteSpace: "nowrap",
};

const userCellStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  whiteSpace: "nowrap",
};

const userAvatarStyle = {
  position: "relative",
  width: 30,
  height: 30,
  minWidth: 30,
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  background:
    "linear-gradient(135deg, #2563eb, #7c3aed)",
  border: "1px solid rgba(147,197,253,0.42)",
  boxShadow: "0 4px 12px rgba(2,6,23,0.20)",
};

const userAvatarFallbackStyle = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#ffffff",
  fontSize: 12,
  fontWeight: 900,
};

const userAvatarImageStyle = {
  position: "absolute",
  inset: 0,
  zIndex: 1,
  width: "100%",
  height: "100%",
  display: "block",
  borderRadius: "50%",
  objectFit: "cover",
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
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const detailButtonStyle = {
  padding: "7px 10px",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  background: "rgba(14,165,233,0.18)",
  color: "#bae6fd",
  fontWeight: 750,
};

const editButtonStyle = {
  padding: "7px 10px",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  background: "rgba(37,99,235,0.22)",
  color: "#dbeafe",
  fontWeight: 750,
};

const deleteButtonStyle = {
  padding: "7px 10px",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  background: "rgba(220,38,38,0.20)",
  color: "#fecaca",
  fontWeight: 750,
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

const detailGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 12,
};

const detailItemStyle = {
  padding: 13,
  borderRadius: 11,
  background: "rgba(15,31,67,0.72)",
  border: "1px solid rgba(148,163,184,0.12)",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const detailLabelStyle = {
  color: "#aebbd3",
  fontSize: 12,
};

const detailValueStyle = {
  color: "#ffffff",
  fontSize: 14,
};

const wktContainerStyle = {
  marginTop: 14,
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const wktStyle = {
  padding: 12,
  borderRadius: 10,
  overflowWrap: "anywhere",
  background: "rgba(15,23,42,0.86)",
  border: "1px solid rgba(148,163,184,0.14)",
  color: "#bfdbfe",
  fontSize: 12,
  fontFamily: "monospace",
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

export default PoisPage;