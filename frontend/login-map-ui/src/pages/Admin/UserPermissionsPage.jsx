import { useEffect, useMemo, useState } from "react";
import axios from "axios";

import AdminPopup from "./AdminPopup";

function UserPermissionsPage({ embedded = false }) {
  const API_BASE_URL = "http://localhost:5075";
  const token = localStorage.getItem("token");

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const [popup, setPopup] = useState({
    open: false,
    title: "",
    text: "",
    onConfirm: null,
  });

  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [rolePermissions, setRolePermissions] = useState([]);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState([]);

  useEffect(() => {
    getAllData();
  }, []);

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

  const getAllData = async () => {
    try {
      const [
        usersResponse,
        permissionsResponse,
        userPermissionsResponse,
        userRolesResponse,
        rolePermissionsResponse,
      ] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/users`, config),
        axios.get(`${API_BASE_URL}/api/permissions`, config),
        axios.get(`${API_BASE_URL}/api/userpermissions`, config),
        axios.get(`${API_BASE_URL}/api/userroles`, config),
        axios.get(`${API_BASE_URL}/api/rolepermissions`, config),
      ]);

      setUsers(usersResponse.data);
      setPermissions(permissionsResponse.data);
      setUserPermissions(userPermissionsResponse.data);
      setUserRoles(userRolesResponse.data);
      setRolePermissions(rolePermissionsResponse.data);
    } catch (error) {
      console.error("Kullanıcı-yetki verileri alınamadı:", error);
      showInfo(
        "Hata",
        "Kullanıcı-yetki verileri alınırken bir hata oluştu."
      );
    }
  };

  const selectedUserRoleNames = useMemo(() => {
    if (!selectedUserId) return [];

    return userRoles
      .filter(
        (item) => Number(item.userId) === Number(selectedUserId)
      )
      .map((item) => item.roleName)
      .filter(Boolean);
  }, [selectedUserId, userRoles]);

  const inheritedPermissionMap = useMemo(() => {
    const map = new Map();

    rolePermissions
      .filter((item) =>
        selectedUserRoleNames.includes(item.roleName)
      )
      .forEach((item) => {
        const permissionName = item.permissionName;

        if (!permissionName) return;

        const key = permissionName.toLocaleLowerCase("tr-TR");

        if (!map.has(key)) {
          map.set(key, item.roleName);
        }
      });

    return map;
  }, [selectedUserRoleNames, rolePermissions]);

  const directPermissionIdSet = useMemo(() => {
    return new Set(
      userPermissions
        .filter(
          (item) =>
            Number(item.userId) === Number(selectedUserId)
        )
        .map((item) => Number(item.permissionId))
    );
  }, [selectedUserId, userPermissions]);

  const getPermissionRoleSource = (permission) => {
    if (!permission?.name) return null;

    return (
      inheritedPermissionMap.get(
        permission.name.toLocaleLowerCase("tr-TR")
      ) ?? null
    );
  };

  const togglePermission = (permissionId) => {
    setSelectedPermissionIds((current) => {
      if (current.includes(permissionId)) {
        return current.filter((id) => id !== permissionId);
      }

      return [...current, permissionId];
    });
  };

  const assignPermissions = async () => {
    if (!selectedUserId) {
      showInfo("Eksik Bilgi", "Önce bir kullanıcı seçiniz.");
      return;
    }

    if (selectedPermissionIds.length === 0) {
      showInfo("Eksik Bilgi", "En az bir yetki seçiniz.");
      return;
    }

    const validPermissionIds = selectedPermissionIds.filter(
      (permissionId) => {
        const permission = permissions.find(
          (item) => Number(item.id) === Number(permissionId)
        );

        const inherited = getPermissionRoleSource(permission);
        const direct = directPermissionIdSet.has(Number(permissionId));

        return !inherited && !direct;
      }
    );

    if (validPermissionIds.length === 0) {
      showInfo(
        "Mevcut Yetkiler",
        "Seçtiğiniz yetkilerin tamamı kullanıcıda zaten mevcut."
      );
      return;
    }

    try {
      await Promise.all(
        validPermissionIds.map((permissionId) =>
          axios.post(
            `${API_BASE_URL}/api/userpermissions`,
            {
              userId: Number(selectedUserId),
              permissionId: Number(permissionId),
            },
            config
          )
        )
      );

      setSelectedPermissionIds([]);
      await getAllData();

      showInfo(
        "Başarılı",
        `${validPermissionIds.length} yetki kullanıcıya atandı.`
      );
    } catch (error) {
      console.error("Yetkiler atanamadı:", error);

      const message =
        error.response?.data?.message ||
        error.response?.data?.title ||
        "Yetkiler atanırken bir hata oluştu.";

      showInfo("Bilgilendirme", message);
    }
  };

  const deleteUserPermission = (item) => {
    showConfirm(
      "Yetkiyi Kaldır",
      `${item.permissionName} yetkisi ${
        item.username ?? item.userName
      } kullanıcısından kaldırılsın mı?`,
      async () => {
        try {
          await axios.delete(
            `${API_BASE_URL}/api/userpermissions/${item.id}`,
            config
          );

          closePopup();
          await getAllData();
        } catch (error) {
          console.error("Kullanıcı yetkisi silinemedi:", error);
          closePopup();
          showInfo(
            "Hata",
            "Yetki kullanıcıdan kaldırılırken bir hata oluştu."
          );
        }
      }
    );
  };

  return (
    <div style={pageStyles.page}>
      {!embedded && (
        <h1 style={pageStyles.pageTitle}>
          Kullanıcı-Yetki Yönetimi
        </h1>
      )}

      <div style={pageStyles.assignmentPanel}>
        <h2 style={pageStyles.panelTitle}>Ekstra Yetki Ata</h2>

        <div style={pageStyles.userRow}>
          <select
            style={pageStyles.select}
            value={selectedUserId}
            onChange={(event) => {
              setSelectedUserId(event.target.value);
              setSelectedPermissionIds([]);
            }}
          >
            <option value="">Kullanıcı seçiniz</option>

            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={assignPermissions}
            style={pageStyles.assignButton}
          >
            Seçilen Yetkileri Ata
          </button>
        </div>

        {selectedUserId && selectedUserRoleNames.length > 0 && (
          <div style={pageStyles.roleInfoBar}>
            <span style={pageStyles.roleInfoLabel}>
              Kullanıcının rolleri:
            </span>

            <div style={pageStyles.roleInfoList}>
              {selectedUserRoleNames.map((roleName) => (
                <span key={roleName} style={pageStyles.roleInfoItem}>
                  {roleName}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={pageStyles.permissionPicker}>
          {permissions.map((permission) => {
            const permissionId = Number(permission.id);
            const sourceRole = getPermissionRoleSource(permission);
            const directExists =
              directPermissionIdSet.has(permissionId);
            const disabled =
              !selectedUserId || Boolean(sourceRole) || directExists;
            const selected =
              selectedPermissionIds.includes(permissionId);

            return (
              <button
                key={permission.id}
                type="button"
                disabled={disabled}
                onClick={() => togglePermission(permissionId)}
                style={{
                  ...pageStyles.permissionChoice,
                  ...(selected
                    ? pageStyles.permissionChoiceSelected
                    : {}),
                  ...(sourceRole
                    ? pageStyles.permissionChoiceInherited
                    : {}),
                  ...(directExists
                    ? pageStyles.permissionChoiceAssigned
                    : {}),
                  ...(!selectedUserId
                    ? pageStyles.permissionChoiceDisabled
                    : {}),
                }}
              >
                <span style={pageStyles.permissionChoiceName}>
                  {permission.name}
                </span>

                {sourceRole && (
                  <span style={pageStyles.roleSource}>
                    {sourceRole} rolünden
                  </span>
                )}

                {!sourceRole && directExists && (
                  <span style={pageStyles.directSource}>
                    Kullanıcıda mevcut
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={pageStyles.tableWrapper}>
        <table style={pageStyles.table}>
          <thead>
            <tr>
              <th style={pageStyles.th}>Kullanıcı</th>
              <th style={pageStyles.th}>Yetki</th>
              <th style={pageStyles.th}>Kaynak</th>
              <th style={pageStyles.th}>İşlem</th>
            </tr>
          </thead>

          <tbody>
            {userPermissions.map((item) => (
              <tr key={item.id}>
                <td style={pageStyles.td}>
                  {item.username ?? item.userName}
                </td>

                <td style={pageStyles.td}>
                  {item.permissionName}
                </td>

                <td style={pageStyles.td}>
                  <span style={pageStyles.sourceBadge}>
                    Kullanıcıya özel
                  </span>
                </td>

                <td style={pageStyles.td}>
                  <button
                    type="button"
                    onClick={() => deleteUserPermission(item)}
                    style={pageStyles.removeButton}
                  >
                    Kaldır
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
        confirmText={
          popup.onConfirm ? "Evet, Kaldır" : "Tamam"
        }
      />
    </div>
  );
}

const pageStyles = {
  page: {
    width: "100%",
  },

  pageTitle: {
    margin: "0 0 14px",
    color: "#ffffff",
    fontSize: 28,
  },

  assignmentPanel: {
    padding: 16,
    marginBottom: 14,
    borderRadius: 14,
    background: "rgba(8,18,55,0.72)",
    border: "1px solid rgba(96,165,250,0.16)",
  },

  panelTitle: {
    margin: "0 0 14px",
    color: "#ffffff",
    fontSize: 17,
    fontWeight: 900,
    textAlign: "center",
  },

  userRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },

  select: {
    minWidth: 250,
    height: 38,
    padding: "8px 11px",
    borderRadius: 9,
    border: "1px solid rgba(148,163,184,0.24)",
    background: "rgba(15,23,42,0.86)",
    color: "#ffffff",
    outline: "none",
    fontSize: 11,
  },

  assignButton: {
    minHeight: 38,
    padding: "8px 14px",
    borderRadius: 9,
    border: "1px solid rgba(96,165,250,0.34)",
    background: "rgba(37,99,235,0.18)",
    color: "#dbeafe",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 800,
  },

  roleInfoBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
    padding: "8px 10px",
    borderRadius: 9,
    background: "rgba(15,31,67,0.4)",
    border: "1px solid rgba(96,165,250,0.1)",
  },

  roleInfoLabel: {
    color: "#8ea0bc",
    fontSize: 10,
    fontWeight: 700,
  },

  roleInfoList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },

  roleInfoItem: {
    color: "#bfdbfe",
    fontSize: 10,
    fontWeight: 800,
  },

  permissionPicker: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fill, minmax(185px, 1fr))",
    gap: 7,
  },

  permissionChoice: {
    minHeight: 44,
    padding: "8px 10px",
    borderRadius: 9,
    border: "1px solid rgba(96,165,250,0.13)",
    background: "rgba(15,31,67,0.5)",
    color: "#cbd5e1",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 3,
    textAlign: "left",
  },

  permissionChoiceName: {
    color: "inherit",
    fontSize: 11,
    fontWeight: 800,
  },

  permissionChoiceSelected: {
    border: "1px solid rgba(96,165,250,0.42)",
    background: "rgba(37,99,235,0.17)",
    color: "#ffffff",
  },

  permissionChoiceInherited: {
    border: "1px solid rgba(245,158,11,0.16)",
    background: "rgba(120,53,15,0.12)",
    color: "#fcd34d",
    cursor: "not-allowed",
  },

  permissionChoiceAssigned: {
    border: "1px solid rgba(59,130,246,0.16)",
    background: "rgba(30,64,175,0.12)",
    color: "#93c5fd",
    cursor: "not-allowed",
  },

  permissionChoiceDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },

  roleSource: {
    color: "#d6a326",
    fontSize: 9,
    fontWeight: 800,
  },

  directSource: {
    color: "#7fb2ef",
    fontSize: 9,
    fontWeight: 800,
  },

  tableWrapper: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "0 6px",
  },

  th: {
    padding: "11px 13px",
    background: "rgba(10,20,50,0.92)",
    color: "#dce8ff",
    textAlign: "left",
    fontSize: 12,
    fontWeight: 800,
  },

  td: {
    padding: "11px 13px",
    background: "rgba(15,31,67,0.78)",
    color: "#e7efff",
    borderTop: "1px solid rgba(148,163,184,0.08)",
    borderBottom: "1px solid rgba(148,163,184,0.08)",
    fontSize: 12,
  },

  sourceBadge: {
    display: "inline-flex",
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(30,64,175,0.12)",
    border: "1px solid rgba(59,130,246,0.17)",
    color: "#93c5fd",
    fontSize: 9,
    fontWeight: 800,
  },

  removeButton: {
    minHeight: 30,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(248,113,113,0.22)",
    background: "rgba(127,29,29,0.09)",
    color: "#fca5a5",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 800,
  },
};

export default UserPermissionsPage;
