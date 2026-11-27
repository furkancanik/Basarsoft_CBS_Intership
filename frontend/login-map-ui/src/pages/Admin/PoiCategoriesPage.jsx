import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import AdminPopup from "./AdminPopup";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5075";

function PoiCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  const token = localStorage.getItem("token");

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const mainCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.parentId === null ||
          category.parentId === undefined
      ),
    [categories]
  );

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);

    window.setTimeout(() => {
      setMessage("");
    }, 3000);
  };

  const getErrorMessage = (error, fallbackMessage) => {
    const responseMessage = error.response?.data?.message;
    const stringResponse = error.response?.data;

    if (responseMessage) {
      return responseMessage;
    }

    if (typeof stringResponse === "string") {
      return stringResponse;
    }

    return fallbackMessage;
  };

  const loadCategories = async () => {
    try {
      setLoading(true);

      const response = await axios.get(
        `${API_BASE_URL}/api/PoiCategories`,
        config
      );

      setCategories(response.data);
    } catch (error) {
      console.error("Kategoriler alınamadı:", error);

      showMessage(
        getErrorMessage(
          error,
          "Kategoriler yüklenirken hata oluştu."
        ),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const resetForm = () => {
    setName("");
    setParentId("");
    setEditingCategory(null);
    setIsActive(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name.trim()) {
      showMessage("Kategori adı boş olamaz.", "error");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        name: name.trim(),
        parentId: parentId ? Number(parentId) : null,
      };

      if (editingCategory) {
        await axios.put(
          `${API_BASE_URL}/api/PoiCategories/${editingCategory.id}`,
          {
            ...payload,
            isActive,
          },
          config
        );

        showMessage("Kategori başarıyla güncellendi.");
      } else {
        await axios.post(
          `${API_BASE_URL}/api/PoiCategories`,
          payload,
          config
        );

        showMessage("Kategori başarıyla eklendi.");
      }

      resetForm();
      await loadCategories();
    } catch (error) {
      console.error("Kategori kaydedilemedi:", error);

      showMessage(
        getErrorMessage(
          error,
          "Kategori kaydedilirken hata oluştu."
        ),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setName(category.name ?? "");
    setParentId(
      category.parentId !== null &&
        category.parentId !== undefined
        ? String(category.parentId)
        : ""
    );
    setIsActive(category.isActive ?? true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDelete = (category) => {
    setCategoryToDelete(category);
  };

  const closeDeletePopup = () => {
    if (loading) {
      return;
    }

    setCategoryToDelete(null);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) {
      return;
    }

    const deletingCategory = categoryToDelete;

    try {
      setLoading(true);

      await axios.delete(
        `${API_BASE_URL}/api/PoiCategories/${deletingCategory.id}`,
        config
      );

      if (editingCategory?.id === deletingCategory.id) {
        resetForm();
      }

      setCategoryToDelete(null);
      showMessage("Kategori başarıyla silindi.");
      await loadCategories();
    } catch (error) {
      console.error("Kategori silinemedi:", error);

      showMessage(
        getErrorMessage(
          error,
          "Kategori silinirken hata oluştu."
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

    return new Date(dateValue).toLocaleString("tr-TR");
  };

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>POI Kategori Yönetimi</h1>

          <p style={descriptionStyle}>
            Ana kategori ve alt kategori ekleyebilir,
            mevcut kategorileri düzenleyebilirsin.
          </p>
        </div>

        <div style={countCardStyle}>
          <span style={countLabelStyle}>Toplam kategori</span>
          <strong style={countValueStyle}>
            {categories.length}
          </strong>
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

      <form onSubmit={handleSubmit} style={formCardStyle}>
        <h2 style={sectionTitleStyle}>
          {editingCategory
            ? "Kategoriyi Düzenle"
            : "Yeni Kategori Ekle"}
        </h2>

        <div style={formGridStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>
              Kategori adı
            </label>

            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="Örnek: Restoran"
              style={inputStyle}
              disabled={loading}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>
              Üst kategori
            </label>

            <select
              value={parentId}
              onChange={(event) =>
                setParentId(event.target.value)
              }
              style={inputStyle}
              disabled={loading}
            >
              <option value="">
                Ana kategori olarak ekle
              </option>

              {mainCategories
                .filter(
                  (category) =>
                    category.id !== editingCategory?.id
                )
                .map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                ))}
            </select>
          </div>

          {editingCategory && (
            <div style={fieldStyle}>
              <label style={labelStyle}>
                Durum
              </label>

              <select
                value={isActive ? "true" : "false"}
                onChange={(event) =>
                  setIsActive(
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
          )}
        </div>

        <div style={buttonRowStyle}>
          <button
            type="submit"
            style={primaryButtonStyle}
            disabled={loading}
          >
            {loading
              ? "İşlem yapılıyor..."
              : editingCategory
                ? "Güncelle"
                : "Kategori Ekle"}
          </button>

          {editingCategory && (
            <button
              type="button"
              onClick={resetForm}
              style={secondaryButtonStyle}
              disabled={loading}
            >
              İptal
            </button>
          )}
        </div>
      </form>

      <div style={tableCardStyle}>
        <div style={tableHeaderStyle}>
          <h2 style={sectionTitleStyle}>
            Kategori Listesi
          </h2>

          <button
            type="button"
            onClick={loadCategories}
            style={refreshButtonStyle}
            disabled={loading}
          >
            Yenile
          </button>
        </div>

        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Kategori</th>
                <th style={thStyle}>Üst kategori</th>
                <th style={thStyle}>Tür</th>
                <th style={thStyle}>Durum</th>
                <th style={thStyle}>Oluşturulma</th>
                <th style={thStyle}>İşlemler</th>
              </tr>
            </thead>

            <tbody>
              {loading && categories.length === 0 ? (
                <tr>
                  <td colSpan="6" style={emptyStyle}>
                    Kategoriler yükleniyor...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan="6" style={emptyStyle}>
                    Kategori bulunamadı.
                  </td>
                </tr>
              ) : (
                categories.map((category) => {
                  const isMainCategory =
                    category.parentId === null ||
                    category.parentId === undefined;

                  return (
                    <tr key={category.id}>
                      <td style={tdStyle}>
                        <strong>
                          {category.name}
                        </strong>
                      </td>

                      <td style={tdStyle}>
                        {category.parentName ?? "-"}
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            ...badgeStyle,
                            ...(isMainCategory
                              ? mainBadgeStyle
                              : childBadgeStyle),
                          }}
                        >
                          {isMainCategory
                            ? "Ana kategori"
                            : "Alt kategori"}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            ...badgeStyle,
                            ...(category.isActive
                              ? activeBadgeStyle
                              : passiveBadgeStyle),
                          }}
                        >
                          {category.isActive
                            ? "Aktif"
                            : "Pasif"}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        {formatDate(
                          category.createdDate
                        )}
                      </td>

                      <td style={tdStyle}>
                        <div style={actionRowStyle}>
                          <button
                            type="button"
                            onClick={() =>
                              handleEdit(category)
                            }
                            style={editButtonStyle}
                          >
                            Düzenle
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(category)
                            }
                            style={deleteButtonStyle}
                          >
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminPopup
        open={Boolean(categoryToDelete)}
        type="danger"
        title="Kategori silinsin mi?"
        text={
          categoryToDelete
            ? `"${categoryToDelete.name}" kategorisi silinecek. Bu kategoriye bağlı alt kategoriler ve POI kayıtları da pasif hale getirilip silinmiş olarak işaretlenecektir.`
            : ""
        }
        confirmText="Kategoriyi Sil"
        cancelText="Vazgeç"
        onClose={closeDeletePopup}
        onConfirm={confirmDeleteCategory}
        loading={loading}
      />
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
  color: "#b9c8e3",
  fontSize: 14,
};

const countCardStyle = {
  minWidth: 150,
  padding: "14px 18px",
  borderRadius: 14,
  background: "rgba(15,31,67,0.84)",
  border: "1px solid rgba(96,165,250,0.22)",
  display: "flex",
  flexDirection: "column",
  gap: 3,
};

const countLabelStyle = {
  color: "#aebbd3",
  fontSize: 12,
};

const countValueStyle = {
  color: "#ffffff",
  fontSize: 25,
};

const formCardStyle = {
  padding: 22,
  borderRadius: 17,
  background: "rgba(8,18,55,0.86)",
  border: "1px solid rgba(96,165,250,0.20)",
  boxShadow: "0 20px 45px rgba(0,0,0,0.24)",
  backdropFilter: "blur(14px)",
};

const tableCardStyle = {
  padding: 20,
  borderRadius: 17,
  background: "rgba(8,18,55,0.86)",
  border: "1px solid rgba(96,165,250,0.20)",
  boxShadow: "0 20px 45px rgba(0,0,0,0.24)",
  overflow: "hidden",
};

const sectionTitleStyle = {
  margin: 0,
  color: "#ffffff",
  fontSize: 20,
  fontWeight: 850,
};

const formGridStyle = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
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

const buttonRowStyle = {
  marginTop: 18,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const primaryButtonStyle = {
  minHeight: 41,
  padding: "9px 18px",
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
  padding: "9px 18px",
  border: "1px solid rgba(148,163,184,0.30)",
  borderRadius: 10,
  cursor: "pointer",
  color: "#dce8ff",
  fontWeight: 750,
  background: "rgba(30,41,59,0.80)",
};

const tableHeaderStyle = {
  marginBottom: 14,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const refreshButtonStyle = {
  padding: "8px 14px",
  border: "1px solid rgba(96,165,250,0.30)",
  borderRadius: 9,
  cursor: "pointer",
  background: "rgba(37,99,235,0.16)",
  color: "#dbeafe",
  fontWeight: 750,
};

const tableWrapperStyle = {
  width: "100%",
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  minWidth: 850,
  borderCollapse: "collapse",
};

const thStyle = {
  padding: "13px 12px",
  textAlign: "left",
  color: "#e5efff",
  fontSize: 13,
  borderBottom: "1px solid rgba(148,163,184,0.16)",
};

const tdStyle = {
  padding: "13px 12px",
  color: "#e7efff",
  fontSize: 13,
  borderBottom: "1px solid rgba(148,163,184,0.10)",
};

const emptyStyle = {
  ...tdStyle,
  textAlign: "center",
  padding: 30,
  color: "#aebbd3",
};

const badgeStyle = {
  display: "inline-flex",
  padding: "5px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
};

const mainBadgeStyle = {
  color: "#bfdbfe",
  background: "rgba(37,99,235,0.20)",
};

const childBadgeStyle = {
  color: "#ddd6fe",
  background: "rgba(124,58,237,0.20)",
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
  gap: 7,
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

export default PoiCategoriesPage;