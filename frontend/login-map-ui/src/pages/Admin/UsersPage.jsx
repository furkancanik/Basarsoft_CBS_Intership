import { useEffect, useState } from "react";
import axios from "axios";

import AdminPopup from "./AdminPopup";

function UsersPage() {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5075";
  const token = localStorage.getItem("token");

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const [users, setUsers] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const [form, setForm] = useState({
    username: "",
    password: "",
    isActive: true,
  });

  const [loading, setLoading] = useState(true);

  const [popup, setPopup] = useState({
    open: false,
    title: "",
    text: "",
    onConfirm: null,
  });

  useEffect(() => {
    getAllData();
  }, []);

  const getAllData = async () => {
    try {
      setLoading(true);

      const [
        usersResponse,
        userRolesResponse,
        rolePermissionsResponse,
        userPermissionsResponse,
      ] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/users`, config),
        axios.get(`${API_BASE_URL}/api/userroles`, config),
        axios.get(`${API_BASE_URL}/api/rolepermissions`, config),
        axios.get(`${API_BASE_URL}/api/userpermissions`, config),
      ]);

      setUsers(usersResponse.data);
      setUserRoles(userRolesResponse.data);
      setRolePermissions(rolePermissionsResponse.data);
      setUserPermissions(userPermissionsResponse.data);
    } catch (error) {
      console.error("Kullanıcı verileri alınamadı:", error);
      showInfo(
        "Hata",
        "Kullanıcı, rol ve yetki bilgileri alınırken bir hata oluştu."
      );
    } finally {
      setLoading(false);
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
      username: "",
      password: "",
      isActive: true,
    });

    setEditingUser(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsFormModalOpen(true);
  };

  const openEditModal = (user, event) => {
    event?.stopPropagation();

    setEditingUser(user);

    setForm({
      username: user.username ?? "",
      password: "",
      isActive: user.isActive ?? true,
    });

    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    resetForm();
    setIsFormModalOpen(false);
  };

  const saveUser = async () => {
    const username = form.username.trim();
    const password = form.password.trim();

    if (!username) {
      showInfo("Eksik Bilgi", "Kullanıcı adı giriniz.");
      return;
    }

    if (!editingUser && !password) {
      showInfo("Eksik Bilgi", "Yeni kullanıcı için şifre giriniz.");
      return;
    }

    try {
      if (editingUser) {
        await axios.put(
          `${API_BASE_URL}/api/users/${editingUser.id}`,
          {
            username,
            password,
            isActive: form.isActive,
          },
          config
        );

        showInfo("Başarılı", "Kullanıcı bilgileri güncellendi.");
      } else {
        await axios.post(
          `${API_BASE_URL}/api/users`,
          {
            username,
            password,
          },
          config
        );

        showInfo("Başarılı", "Yeni kullanıcı eklendi.");
      }

      closeFormModal();
      await getAllData();
    } catch (error) {
      console.error("Kullanıcı kaydedilemedi:", error);

      const message =
        error.response?.data?.message ||
        error.response?.data ||
        "Kullanıcı kaydedilirken bir hata oluştu.";

      showInfo("Hata", String(message));
    }
  };

  const requestDeleteUser = (user, event) => {
    event?.stopPropagation();

    showConfirm(
      "Kullanıcıyı Sil",
      `${user.username} adlı kullanıcı silinsin mi?`,
      async () => {
        try {
          await axios.delete(
            `${API_BASE_URL}/api/users/${user.id}`,
            config
          );

          closePopup();

          if (selectedUser?.id === user.id) {
            setSelectedUser(null);
          }

          await getAllData();
        } catch (error) {
          console.error("Kullanıcı silinemedi:", error);
          closePopup();
          showInfo(
            "Hata",
            "Kullanıcı silinirken bir hata oluştu."
          );
        }
      }
    );
  };

  const imgSrc = (url) => {
    if (!url) return "";

    return url.startsWith("http")
      ? url
      : `${API_BASE_URL}${url}`;
  };

  const getUserRoles = (userId) => {
    return userRoles
      .filter((item) => Number(item.userId) === Number(userId))
      .map((item) => ({
        id: item.roleId ?? item.id,
        name: item.roleName,
      }))
      .filter((item) => item.name);
  };

  const getUserPermissions = (userId) => {
    const roles = getUserRoles(userId);
    const roleNames = roles.map((role) => role.name);

    const inherited = rolePermissions
      .filter((item) => roleNames.includes(item.roleName))
      .map((item) => ({
        name: item.permissionName,
        type: "role",
        roleName: item.roleName,
        source: `${item.roleName} rolünden`,
      }))
      .filter((item) => item.name);

    const direct = userPermissions
      .filter((item) => Number(item.userId) === Number(userId))
      .map((item) => ({
        name: item.permissionName,
        type: "direct",
        roleName: null,
        source: "Kullanıcıya özel",
      }))
      .filter((item) => item.name);

    const unique = new Map();

    inherited.forEach((item) => {
      const key = item.name.toLocaleLowerCase("tr-TR");

      if (!unique.has(key)) {
        unique.set(key, item);
      }
    });

    direct.forEach((item) => {
      const key = item.name.toLocaleLowerCase("tr-TR");

      if (!unique.has(key)) {
        unique.set(key, item);
      }
    });

    return Array.from(unique.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "tr")
    );
  };

  const Avatar = ({ user, size = 82 }) => {
    const source = imgSrc(user.profileImageUrl);

    if (source) {
      return (
        <img
          src={source}
          alt={user.username}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            objectFit: "cover",
            border: "3px solid #60a5fa",
            boxShadow: "0 0 26px rgba(96,165,250,0.38)",
          }}
        />
      );
    }

    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #2563eb, #60a5fa)",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size / 2.5,
          fontWeight: 900,
          border: "3px solid #60a5fa",
          boxShadow: "0 0 26px rgba(96,165,250,0.34)",
        }}
      >
        {user.username?.charAt(0).toUpperCase() || "?"}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={pageStyles.loading}>
        Kullanıcılar yükleniyor...
      </div>
    );
  }

  const selectedRoles = selectedUser
    ? getUserRoles(selectedUser.id)
    : [];

  const selectedPermissions = selectedUser
    ? getUserPermissions(selectedUser.id)
    : [];

  return (
    <div style={pageStyles.page}>
      <style>
        {`
          @keyframes userCardWiggle {
            0%, 75%, 100% { transform: rotate(0deg); }
            2.5%, 7.5%, 12.5%, 17.5%, 22.5%, 27.5%, 32.5%, 37.5%, 42.5%, 47.5%, 52.5%, 57.5%, 62.5%, 67.5%, 72.5% {
              transform: rotate(0.8deg);
            }
            5%, 10%, 15%, 20%, 25%, 30%, 35%, 40%, 45%, 50%, 55%, 60%, 65%, 70% {
              transform: rotate(-0.8deg);
            }
          }

          .user-card-wiggle {
            transform-origin: center center;
            animation: userCardWiggle 4s linear infinite;
          }

          .user-card-wiggle:nth-child(2n) {
            animation-delay: .08s;
          }

          .user-card-wiggle:nth-child(3n) {
            animation-delay: .16s;
          }
        `}
      </style>

      <div style={pageStyles.header}>
        <div>
          <h1 style={pageStyles.title}>Kullanıcılar</h1>

          <p style={pageStyles.subtitle}>
            Kullanıcıları yönetin, rollerini ve yetkilerini görüntüleyin.
          </p>
        </div>

        <div style={pageStyles.headerActions}>
          <button
            type="button"
            onClick={() => setIsEditMode((current) => !current)}
            style={{
              ...pageStyles.manageButton,
              ...(isEditMode ? pageStyles.manageButtonActive : {}),
            }}
          >
            {isEditMode ? "Düzenlemeyi Bitir" : "Kullanıcıları Düzenle"}
          </button>

          <button
            type="button"
            onClick={openAddModal}
            style={pageStyles.addButton}
          >
            + Kullanıcı Ekle
          </button>
        </div>
      </div>

      {users.length === 0 ? (
        <div style={pageStyles.emptyState}>
          Henüz kullanıcı bulunmuyor.
        </div>
      ) : (
        <div style={pageStyles.grid}>
          {users.map((user) => (
            <div
              key={user.id}
              role="button"
              tabIndex={0}
              className={
                isEditMode
                  ? "user-card user-card-wiggle"
                  : "user-card"
              }
              onClick={() => {
                if (!isEditMode) {
                  setSelectedUser(user);
                }
              }}
              onKeyDown={(event) => {
                if (
                  !isEditMode &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  setSelectedUser(user);
                }
              }}
              style={pageStyles.userCard}
            >
              <div style={pageStyles.statusRow}>
                <span
                  style={{
                    ...pageStyles.statusBadge,
                    ...(user.isActive
                      ? pageStyles.activeBadge
                      : pageStyles.passiveBadge),
                  }}
                >
                  {user.isActive ? "Aktif" : "Pasif"}
                </span>
              </div>

              <Avatar user={user} />

              <div style={pageStyles.username}>
                {user.username}
              </div>

              {isEditMode && (
                <div style={pageStyles.cardActions}>
                  <button
                    type="button"
                    style={pageStyles.editButton}
                    onClick={(event) =>
                      openEditModal(user, event)
                    }
                  >
                    Düzenle
                  </button>

                  <button
                    type="button"
                    style={pageStyles.deleteButton}
                    onClick={(event) =>
                      requestDeleteUser(user, event)
                    }
                  >
                    Sil
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedUser && (
        <div
          style={pageStyles.overlay}
          onClick={() => setSelectedUser(null)}
        >
          <div
            style={pageStyles.detailModal}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              style={pageStyles.closeButton}
              onClick={() => setSelectedUser(null)}
            >
              ×
            </button>

            <div style={pageStyles.modalHeader}>
              <Avatar user={selectedUser} size={88} />

              <div>
                <h2 style={pageStyles.modalUsername}>
                  {selectedUser.username}
                </h2>

                <div style={pageStyles.modalCountRow}>
                  <span>{selectedRoles.length} Rol</span>
                  <span style={pageStyles.modalCountDot}>•</span>
                  <span>{selectedPermissions.length} Yetki</span>
                </div>

                <span
                  style={{
                    ...pageStyles.statusBadge,
                    ...(selectedUser.isActive
                      ? pageStyles.activeBadge
                      : pageStyles.passiveBadge),
                  }}
                >
                  {selectedUser.isActive ? "Aktif" : "Pasif"}
                </span>
              </div>
            </div>

            <div style={pageStyles.section}>
              <h3 style={pageStyles.sectionTitle}>Roller</h3>

              {selectedRoles.length > 0 ? (
                <div style={pageStyles.roleList}>
                  {selectedRoles.map((role) => (
                    <div key={`${role.id}-${role.name}`} style={pageStyles.roleRow}>
                      <span style={pageStyles.roleDot} />
                      <span style={pageStyles.roleName}>{role.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={pageStyles.emptyText}>
                  Rol atanmamış
                </span>
              )}
            </div>

            <div style={pageStyles.section}>
              <div style={pageStyles.sectionHeaderRow}>
                <h3 style={pageStyles.sectionTitle}>Yetkiler</h3>

                <div style={pageStyles.legend}>
                  <span style={pageStyles.legendItem}>
                    <span style={pageStyles.legendRoleDot} />
                    Rolden
                  </span>

                  <span style={pageStyles.legendItem}>
                    <span style={pageStyles.legendDirectDot} />
                    Özel
                  </span>
                </div>
              </div>

              {selectedPermissions.length > 0 ? (
                <div style={pageStyles.permissionList}>
                  {selectedPermissions.map((permission) => (
                    <div
                      key={`${permission.type}-${permission.name}`}
                      style={pageStyles.permissionRow}
                    >
                      <div style={pageStyles.permissionLeft}>
                        <span
                          style={{
                            ...pageStyles.permissionTypeDot,
                            ...(permission.type === "role"
                              ? pageStyles.permissionRoleDot
                              : pageStyles.permissionDirectDot),
                          }}
                        />

                        <span style={pageStyles.permissionName}>
                          {permission.name}
                        </span>
                      </div>

                      <span
                        style={{
                          ...pageStyles.permissionSourceBadge,
                          ...(permission.type === "role"
                            ? pageStyles.roleSourceBadge
                            : pageStyles.directSourceBadge),
                        }}
                      >
                        {permission.source}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={pageStyles.emptyText}>
                  Yetki atanmamış
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {isFormModalOpen && (
        <div
          style={pageStyles.overlay}
          onClick={closeFormModal}
        >
          <div
            style={pageStyles.formModal}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              style={pageStyles.closeButton}
              onClick={closeFormModal}
            >
              ×
            </button>

            <h2 style={pageStyles.formModalTitle}>
              {editingUser
                ? "Kullanıcı Güncelle"
                : "Yeni Kullanıcı Ekle"}
            </h2>

            <p style={pageStyles.formModalDescription}>
              {editingUser
                ? "Kullanıcı adı, şifre veya durum bilgisini güncelleyin."
                : "Yeni kullanıcı için kullanıcı adı ve şifre girin."}
            </p>

            <div style={pageStyles.formGroup}>
              <label style={pageStyles.label}>
                Kullanıcı adı
              </label>

              <input
                style={pageStyles.input}
                placeholder="Kullanıcı adı"
                value={form.username}
                onChange={(event) =>
                  setForm({
                    ...form,
                    username: event.target.value,
                  })
                }
              />
            </div>

            <div style={pageStyles.formGroup}>
              <label style={pageStyles.label}>Şifre</label>

              <input
                style={pageStyles.input}
                type="password"
                placeholder={
                  editingUser
                    ? "Değişmeyecekse boş bırakın"
                    : "Şifre"
                }
                value={form.password}
                onChange={(event) =>
                  setForm({
                    ...form,
                    password: event.target.value,
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    saveUser();
                  }
                }}
              />
            </div>

            {editingUser && (
              <div style={pageStyles.formGroup}>
                <label style={pageStyles.label}>
                  Kullanıcı Durumu
                </label>

                <div style={pageStyles.statusSelector}>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        isActive: true,
                      })
                    }
                    style={{
                      ...pageStyles.statusOption,
                      ...(form.isActive
                        ? pageStyles.activeStatusOption
                        : {}),
                    }}
                  >
                    Aktif
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        isActive: false,
                      })
                    }
                    style={{
                      ...pageStyles.statusOption,
                      ...(!form.isActive
                        ? pageStyles.passiveStatusOption
                        : {}),
                    }}
                  >
                    Pasif
                  </button>
                </div>
              </div>
            )}

            <div style={pageStyles.formActions}>
              <button
                type="button"
                style={pageStyles.cancelButton}
                onClick={closeFormModal}
              >
                İptal
              </button>

              <button
                type="button"
                style={pageStyles.saveButton}
                onClick={saveUser}
              >
                {editingUser
                  ? "Güncelle"
                  : "Kullanıcı Ekle"}
              </button>
            </div>
          </div>
        </div>
      )}

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

const pageStyles = {
  page: {
    width: "100%",
    color: "#ffffff",
  },

  loading: {
    minHeight: 300,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 800,
  },

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 26,
  },

  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: 32,
    fontWeight: 900,
    letterSpacing: "-0.8px",
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#9fb0cc",
    fontSize: 13,
    fontWeight: 600,
  },

  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  manageButton: {
    minHeight: 42,
    padding: "10px 17px",
    border: "1px solid rgba(96,165,250,0.34)",
    borderRadius: 10,
    background: "rgba(15,31,67,0.76)",
    color: "#bfdbfe",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 800,
  },

  manageButtonActive: {
    background: "rgba(37,99,235,0.26)",
    border: "1px solid rgba(96,165,250,0.58)",
    color: "#ffffff",
  },

  addButton: {
    minHeight: 42,
    padding: "10px 17px",
    border: "1px solid rgba(96,165,250,0.36)",
    borderRadius: 10,
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 800,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 18,
  },

  userCard: {
    position: "relative",
    minHeight: 225,
    padding: "18px 16px 16px",
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(10,23,52,0.82)",
    color: "#ffffff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    cursor: "pointer",
    boxShadow: "0 14px 34px rgba(0,0,0,0.26)",
    outline: "none",
  },

  statusRow: {
    width: "100%",
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: 3,
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
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(34,197,94,0.25)",
    color: "#86efac",
  },

  passiveBadge: {
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(239,68,68,0.25)",
    color: "#fca5a5",
  },

  username: {
    marginTop: 14,
    color: "#ffffff",
    fontSize: 20,
    fontWeight: 900,
    textAlign: "center",
  },

  cardActions: {
    width: "100%",
    display: "flex",
    gap: 8,
    marginTop: "auto",
    paddingTop: 18,
  },

  editButton: {
    flex: 1,
    minHeight: 34,
    border: "1px solid rgba(96,165,250,0.5)",
    borderRadius: 8,
    background: "rgba(37,99,235,0.12)",
    color: "#bfdbfe",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 800,
  },

  deleteButton: {
    flex: 1,
    minHeight: 34,
    border: "1px solid rgba(248,113,113,0.38)",
    borderRadius: 8,
    background: "rgba(127,29,29,0.16)",
    color: "#fca5a5",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 800,
  },

  emptyState: {
    minHeight: 240,
    borderRadius: 16,
    border: "1px solid rgba(96,165,250,0.15)",
    background: "rgba(8,18,55,0.7)",
    color: "#aebbd3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 800,
  },

  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 999999,
    padding: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(1,4,18,0.82)",
    backdropFilter: "blur(8px)",
  },

  detailModal: {
    position: "relative",
    width: 560,
    maxWidth: "100%",
    maxHeight: "86vh",
    padding: 28,
    borderRadius: 20,
    overflowY: "auto",
    background: "rgba(8,18,55,0.98)",
    border: "1px solid rgba(96,165,250,0.28)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.62)",
  },

  formModal: {
    position: "relative",
    width: 430,
    maxWidth: "100%",
    padding: 27,
    borderRadius: 20,
    background: "rgba(8,18,55,0.98)",
    border: "1px solid rgba(96,165,250,0.28)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.62)",
  },

  closeButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    border: "1px solid rgba(148,163,184,0.17)",
    borderRadius: 9,
    background: "rgba(15,23,42,0.88)",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 24,
    lineHeight: 1,
  },

  modalHeader: {
    display: "flex",
    alignItems: "center",
    gap: 18,
    paddingRight: 40,
    marginBottom: 20,
  },

  modalUsername: {
    margin: 0,
    color: "#ffffff",
    fontSize: 28,
    fontWeight: 900,
  },

  modalCountRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: "7px 0 10px",
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 800,
  },

  modalCountDot: {
    color: "#3b82f6",
  },

  section: {
    paddingTop: 16,
    marginTop: 16,
    borderTop: "1px solid rgba(147,197,253,0.15)",
  },

  sectionHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 11,
  },

  sectionTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 17,
    fontWeight: 900,
  },

  roleList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  roleRow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    minHeight: 30,
    padding: "3px 0",
  },

  roleDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#3b82f6",
    boxShadow: "0 0 10px rgba(59,130,246,0.65)",
  },

  roleName: {
    color: "#e8f1ff",
    fontSize: 13,
    fontWeight: 800,
  },

  legend: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    color: "#8ea0bc",
    fontSize: 9,
    fontWeight: 700,
  },

  legendRoleDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#f59e0b",
  },

  legendDirectDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#3b82f6",
  },

  permissionList: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },

  permissionRow: {
    minHeight: 40,
    padding: "8px 10px",
    borderRadius: 9,
    background: "rgba(15,31,67,0.5)",
    border: "1px solid rgba(96,165,250,0.11)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  permissionLeft: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 9,
  },

  permissionTypeDot: {
    width: 7,
    height: 7,
    flexShrink: 0,
    borderRadius: "50%",
  },

  permissionRoleDot: {
    background: "#f59e0b",
    boxShadow: "0 0 9px rgba(245,158,11,0.35)",
  },

  permissionDirectDot: {
    background: "#3b82f6",
    boxShadow: "0 0 9px rgba(59,130,246,0.35)",
  },

  permissionName: {
    color: "#f8fbff",
    fontSize: 12,
    fontWeight: 800,
  },

  permissionSourceBadge: {
    flexShrink: 0,
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 800,
  },

  roleSourceBadge: {
    color: "#fcd34d",
    background: "rgba(120,53,15,0.16)",
    border: "1px solid rgba(245,158,11,0.18)",
  },

  directSourceBadge: {
    color: "#93c5fd",
    background: "rgba(30,64,175,0.14)",
    border: "1px solid rgba(59,130,246,0.18)",
  },

  emptyText: {
    color: "#9fb0cc",
    fontSize: 12,
    fontWeight: 700,
  },

  formModalTitle: {
    margin: "0 40px 8px 0",
    color: "#ffffff",
    fontSize: 23,
    fontWeight: 900,
  },

  formModalDescription: {
    margin: "0 0 21px",
    color: "#9fb0cc",
    fontSize: 12,
    lineHeight: 1.6,
    fontWeight: 600,
  },

  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    marginBottom: 15,
  },

  label: {
    color: "#dce8ff",
    fontSize: 11,
    fontWeight: 800,
  },

  input: {
    width: "100%",
    height: 42,
    padding: "10px 12px",
    borderRadius: 9,
    border: "1px solid rgba(148,163,184,0.27)",
    outline: "none",
    background: "rgba(15,23,42,0.88)",
    color: "#ffffff",
    fontSize: 12,
  },

  statusSelector: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 9,
  },

  statusOption: {
    minHeight: 40,
    borderRadius: 9,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(15,23,42,0.72)",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
  },

  activeStatusOption: {
    background: "rgba(22,101,52,0.24)",
    border: "1px solid rgba(74,222,128,0.36)",
    color: "#86efac",
    boxShadow: "0 8px 20px rgba(22,101,52,0.16)",
  },

  passiveStatusOption: {
    background: "rgba(127,29,29,0.20)",
    border: "1px solid rgba(248,113,113,0.32)",
    color: "#fca5a5",
    boxShadow: "0 8px 20px rgba(127,29,29,0.14)",
  },

  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 9,
    marginTop: 22,
  },

  cancelButton: {
    minHeight: 38,
    padding: "9px 15px",
    border: "1px solid rgba(148,163,184,0.22)",
    borderRadius: 9,
    background: "rgba(51,65,85,0.72)",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
  },

  saveButton: {
    minHeight: 38,
    padding: "9px 15px",
    border: "1px solid rgba(96,165,250,0.35)",
    borderRadius: 9,
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
  },
};

export default UsersPage;
