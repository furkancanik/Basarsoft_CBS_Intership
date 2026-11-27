import { useEffect, useState } from "react";
import axios from "axios";

import styles from "./AdminStyles";
import AdminPopup from "./AdminPopup";

function PermissionsPage({ embedded = false }) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5075";
  const token = localStorage.getItem("token");

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const [permissions, setPermissions] = useState([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
  });
  const [editingPermission, setEditingPermission] = useState(null);

  const [popup, setPopup] = useState({
    open: false,
    title: "",
    text: "",
    onConfirm: null,
  });

  useEffect(() => {
    getPermissions();
  }, []);

  const getPermissions = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/permissions`,
        config
      );

      setPermissions(response.data);
    } catch (error) {
      console.error("Yetkiler alınamadı:", error);
      showInfo("Hata", "Yetkiler alınırken bir hata oluştu.");
    }
  };

  const showInfo = (title, text) => {
    setPopup({
      open: true,
      title,
      text,
      onConfirm: null,
    });
  };

  const showConfirm = (title, text, action) => {
    setPopup({
      open: true,
      title,
      text,
      onConfirm: action,
    });
  };

  const closePopup = () => {
    setPopup({
      open: false,
      title: "",
      text: "",
      onConfirm: null,
    });
  };

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
    });

    setEditingPermission(null);
  };

  const savePermission = async () => {
    if (!form.name.trim()) {
      showInfo("Eksik Bilgi", "Yetki adı giriniz.");
      return;
    }

    try {
      if (editingPermission) {
        await axios.put(
          `${API_BASE_URL}/api/permissions/${editingPermission.id}`,
          {
            name: form.name,
            description: form.description,
            isActive: editingPermission.isActive,
          },
          config
        );

        showInfo("Başarılı", "Yetki güncellendi.");
      } else {
        await axios.post(
          `${API_BASE_URL}/api/permissions`,
          {
            name: form.name,
            description: form.description,
          },
          config
        );

        showInfo("Başarılı", "Yetki eklendi.");
      }

      resetForm();
      await getPermissions();
    } catch (error) {
      console.error("Yetki kaydedilemedi:", error);
      showInfo("Hata", "Yetki kaydedilirken bir hata oluştu.");
    }
  };

  const editPermission = (permission) => {
    setEditingPermission(permission);

    setForm({
      name: permission.name ?? "",
      description: permission.description ?? "",
    });
  };

  const deletePermission = (permission) => {
    showConfirm(
      "Yetkiyi Sil",
      `${permission.name} yetkisi silinsin mi?`,
      async () => {
        try {
          await axios.delete(
            `${API_BASE_URL}/api/permissions/${permission.id}`,
            config
          );

          closePopup();
          await getPermissions();
        } catch (error) {
          console.error("Yetki silinemedi:", error);
          closePopup();
          showInfo("Hata", "Yetki silinirken bir hata oluştu.");
        }
      }
    );
  };

  return (
    <div style={localStyles.page}>
      {!embedded && (
        <h1 style={localStyles.pageTitle}>Yetki Yönetimi</h1>
      )}

      <div style={localStyles.panel}>
        <h2 style={localStyles.panelTitle}>
          {editingPermission
            ? "Yetki Güncelle"
            : "Yeni Yetki Ekle"}
        </h2>

        <div style={localStyles.formRow}>
          <input
            style={styles.input}
            placeholder="Yetki adı"
            value={form.name}
            onChange={(event) =>
              setForm({
                ...form,
                name: event.target.value,
              })
            }
          />

          <input
            style={styles.input}
            placeholder="Açıklama"
            value={form.description}
            onChange={(event) =>
              setForm({
                ...form,
                description: event.target.value,
              })
            }
          />

          <button
            type="button"
            onClick={savePermission}
            style={styles.button}
          >
            {editingPermission ? "Güncelle" : "Yetki Ekle"}
          </button>

          {editingPermission && (
            <button
              type="button"
              onClick={resetForm}
              style={localStyles.cancelButton}
            >
              İptal
            </button>
          )}
        </div>
      </div>

      <div style={localStyles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Id</th>
              <th style={styles.th}>Yetki Adı</th>
              <th style={styles.th}>Açıklama</th>
              <th style={styles.th}>Durum</th>
              <th style={styles.th}>İşlemler</th>
            </tr>
          </thead>

          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.id}>
                <td style={styles.td}>{permission.id}</td>
                <td style={styles.td}>{permission.name}</td>
                <td style={styles.td}>
                  {permission.description || "-"}
                </td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...localStyles.statusBadge,
                      ...(permission.isActive
                        ? localStyles.activeBadge
                        : localStyles.passiveBadge),
                    }}
                  >
                    {permission.isActive ? "Aktif" : "Pasif"}
                  </span>
                </td>
                <td style={styles.td}>
                  <button
                    type="button"
                    onClick={() => editPermission(permission)}
                    style={localStyles.editButton}
                  >
                    Düzenle
                  </button>

                  <button
                    type="button"
                    onClick={() => deletePermission(permission)}
                    style={localStyles.deleteButton}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminPopup
        open={popup.open}
        title={popup.title}
        text={popup.text}
        onClose={closePopup}
        onConfirm={popup.onConfirm}
        confirmText={popup.onConfirm ? "Evet, Sil" : "Tamam"}
      />
    </div>
  );
}

const localStyles = {
  page: {
    width: "100%",
  },

  pageTitle: {
    margin: "0 0 14px",
    fontSize: 28,
    color: "#ffffff",
  },

  panel: {
    padding: 16,
    marginBottom: 14,
    borderRadius: 14,
    background: "rgba(8,18,55,0.72)",
    border: "1px solid rgba(96,165,250,0.16)",
  },

  panelTitle: {
    margin: "0 0 14px",
    fontSize: 17,
    color: "#ffffff",
    textAlign: "center",
  },

  formRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  tableWrapper: {
    width: "100%",
    overflowX: "auto",
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 9px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 800,
  },

  activeBadge: {
    color: "#86efac",
    background: "rgba(22,101,52,0.22)",
    border: "1px solid rgba(74,222,128,0.22)",
  },

  passiveBadge: {
    color: "#fca5a5",
    background: "rgba(127,29,29,0.18)",
    border: "1px solid rgba(248,113,113,0.2)",
  },

  editButton: {
    minHeight: 32,
    padding: "7px 11px",
    marginRight: 7,
    borderRadius: 8,
    border: "1px solid rgba(96,165,250,0.34)",
    background: "rgba(37,99,235,0.1)",
    color: "#bfdbfe",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 800,
  },

  deleteButton: {
    minHeight: 32,
    padding: "7px 11px",
    borderRadius: 8,
    border: "1px solid rgba(248,113,113,0.28)",
    background: "rgba(127,29,29,0.12)",
    color: "#fca5a5",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 800,
  },

  cancelButton: {
    minHeight: 38,
    padding: "9px 13px",
    borderRadius: 9,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(51,65,85,0.42)",
    color: "#cbd5e1",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 800,
  },
};

export default PermissionsPage;
