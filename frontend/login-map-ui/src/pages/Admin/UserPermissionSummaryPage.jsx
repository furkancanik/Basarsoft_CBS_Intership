import { useEffect, useState } from "react";
import axios from "axios";

function UserPermissionSummaryPage() {
  const API_BASE_URL = "http://localhost:5075";
  const token = localStorage.getItem("token");

  const config = {
    headers: { Authorization: `Bearer ${token}` },
  };

  const [users, setUsers] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    getAllData();
  }, []);

  const getAllData = async () => {
    const [usersRes, userRolesRes, rolePermissionsRes, userPermissionsRes] =
      await Promise.all([
        axios.get(`${API_BASE_URL}/api/users`, config),
        axios.get(`${API_BASE_URL}/api/userroles`, config),
        axios.get(`${API_BASE_URL}/api/rolepermissions`, config),
        axios.get(`${API_BASE_URL}/api/userpermissions`, config),
      ]);

    setUsers(usersRes.data);
    setUserRoles(userRolesRes.data);
    setRolePermissions(rolePermissionsRes.data);
    setUserPermissions(userPermissionsRes.data);
  };

  const imgSrc = (url) => {
    if (!url) return "";
    return url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
  };

  const getUserRoles = (userId) =>
    userRoles
      .filter((item) => Number(item.userId) === Number(userId))
      .map((item) => ({
        id: item.roleId ?? item.id,
        name: item.roleName,
      }))
      .filter((item) => item.name);

  const getUserPermissions = (userId) => {
    const roleNames = getUserRoles(userId).map((role) => role.name);

    const inherited = rolePermissions
      .filter((item) => roleNames.includes(item.roleName))
      .map((item) => ({
        name: item.permissionName,
        source: `${item.roleName} rolünden`,
        type: "role",
      }))
      .filter((item) => item.name);

    const direct = userPermissions
      .filter((item) => Number(item.userId) === Number(userId))
      .map((item) => ({
        name: item.permissionName,
        source: "Kullanıcıya özel",
        type: "direct",
      }))
      .filter((item) => item.name);

    const unique = new Map();

    inherited.forEach((item) => {
      const key = item.name.toLocaleLowerCase("tr-TR");
      if (!unique.has(key)) unique.set(key, item);
    });

    direct.forEach((item) => {
      const key = item.name.toLocaleLowerCase("tr-TR");
      if (!unique.has(key)) unique.set(key, item);
    });

    return Array.from(unique.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "tr")
    );
  };

  const Avatar = ({ user, size = 92 }) => {
    const src = imgSrc(user.profileImageUrl);

    if (src) {
      return (
        <img
          src={src}
          alt={user.username}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            objectFit: "cover",
            border: "3px solid #60a5fa",
            boxShadow: "0 0 24px rgba(96,165,250,.38)",
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
          background: "linear-gradient(135deg,#2563eb,#60a5fa)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: size / 2.4,
          border: "3px solid #60a5fa",
          boxShadow: "0 0 24px rgba(96,165,250,.34)",
        }}
      >
        {user.username.charAt(0).toUpperCase()}
      </div>
    );
  };

  const selectedRoles = selectedUser
    ? getUserRoles(selectedUser.id)
    : [];

  const selectedPermissions = selectedUser
    ? getUserPermissions(selectedUser.id)
    : [];

  return (
    <div style={s.page}>
      <h1 style={s.title}>Kullanıcılar</h1>

      <div style={s.grid}>
        {users.map((user) => (
          <button
            key={user.id}
            onClick={() => setSelectedUser(user)}
            style={s.userCard}
          >
            <Avatar user={user} />
            <div style={s.name}>{user.username}</div>
          </button>
        ))}
      </div>

      {selectedUser && (
        <div style={s.overlay} onClick={() => setSelectedUser(null)}>
          <div style={s.modal} onClick={(event) => event.stopPropagation()}>
            <button style={s.close} onClick={() => setSelectedUser(null)}>
              ×
            </button>

            <div style={s.modalHeader}>
              <Avatar user={selectedUser} size={88} />

              <div>
                <h2 style={s.modalName}>{selectedUser.username}</h2>

                <div style={s.countRow}>
                  <span>{selectedRoles.length} Rol</span>
                  <span style={s.countDot}>•</span>
                  <span>{selectedPermissions.length} Yetki</span>
                </div>
              </div>
            </div>

            <div style={s.section}>
              <h3 style={s.sectionTitle}>Roller</h3>

              {selectedRoles.length > 0 ? (
                <div style={s.roleList}>
                  {selectedRoles.map((role) => (
                    <div key={`${role.id}-${role.name}`} style={s.roleRow}>
                      <span style={s.roleDot} />
                      <span style={s.roleName}>{role.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={s.empty}>Rol atanmamış</span>
              )}
            </div>

            <div style={s.section}>
              <h3 style={s.sectionTitle}>Yetkiler</h3>

              {selectedPermissions.length > 0 ? (
                <div style={s.permissionList}>
                  {selectedPermissions.map((permission) => (
                    <div
                      key={`${permission.type}-${permission.name}`}
                      style={s.permissionRow}
                    >
                      <div style={s.permissionLeft}>
                        <span
                          style={{
                            ...s.permissionDot,
                            ...(permission.type === "role"
                              ? s.rolePermissionDot
                              : s.directPermissionDot),
                          }}
                        />

                        <span style={s.permissionName}>
                          {permission.name}
                        </span>
                      </div>

                      <span
                        style={{
                          ...s.sourceBadge,
                          ...(permission.type === "role"
                            ? s.roleSourceBadge
                            : s.directSourceBadge),
                        }}
                      >
                        {permission.source}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={s.empty}>Yetki atanmamış</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    width: "100%",
    boxSizing: "border-box",
    padding: "32px 42px",
    background: "transparent",
    color: "white",
  },

  title: {
    textAlign: "left",
    fontSize: 32,
    fontWeight: 900,
    margin: "0 0 26px",
    color: "#ffffff",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
    gap: 18,
    width: "100%",
  },

  userCard: {
    minHeight: 190,
    borderRadius: 18,
    background: "rgba(10,23,52,0.82)",
    border: "1px solid rgba(148,163,184,.14)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    cursor: "pointer",
    color: "white",
    boxShadow: "0 14px 34px rgba(0,0,0,.26)",
  },

  name: {
    fontSize: 20,
    fontWeight: 900,
    color: "#ffffff",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,.78)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999999,
    padding: 18,
  },

  modal: {
    width: 560,
    maxWidth: "100%",
    maxHeight: "84vh",
    overflowY: "auto",
    borderRadius: 20,
    padding: 28,
    background: "rgba(8,18,55,.98)",
    border: "1px solid rgba(96,165,250,.28)",
    boxShadow: "0 30px 90px rgba(0,0,0,.60)",
    position: "relative",
  },

  close: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    border: "1px solid rgba(148,163,184,.17)",
    borderRadius: 9,
    background: "rgba(15,23,42,.88)",
    color: "white",
    fontSize: 24,
    cursor: "pointer",
  },

  modalHeader: {
    display: "flex",
    alignItems: "center",
    gap: 18,
    marginBottom: 20,
  },

  modalName: {
    fontSize: 28,
    margin: 0,
    fontWeight: 900,
    color: "#ffffff",
  },

  countRow: {
    display: "flex",
    gap: 8,
    marginTop: 7,
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 800,
  },

  countDot: {
    color: "#3b82f6",
  },

  section: {
    borderTop: "1px solid rgba(147,197,253,.15)",
    paddingTop: 16,
    marginTop: 16,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: 900,
    margin: "0 0 11px",
    color: "#ffffff",
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
  },

  roleDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#3b82f6",
  },

  roleName: {
    fontSize: 13,
    fontWeight: 800,
    color: "#e8f1ff",
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
    background: "rgba(15,31,67,.5)",
    border: "1px solid rgba(96,165,250,.11)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  permissionLeft: {
    display: "flex",
    alignItems: "center",
    gap: 9,
  },

  permissionDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
  },

  rolePermissionDot: {
    background: "#f59e0b",
  },

  directPermissionDot: {
    background: "#3b82f6",
  },

  permissionName: {
    fontSize: 12,
    fontWeight: 800,
    color: "#ffffff",
  },

  sourceBadge: {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 800,
  },

  roleSourceBadge: {
    color: "#fcd34d",
    background: "rgba(120,53,15,.16)",
    border: "1px solid rgba(245,158,11,.18)",
  },

  directSourceBadge: {
    color: "#93c5fd",
    background: "rgba(30,64,175,.14)",
    border: "1px solid rgba(59,130,246,.18)",
  },

  empty: {
    color: "#9fb0cc",
    fontWeight: 700,
    fontSize: 12,
  },
};

export default UserPermissionSummaryPage;
