import { useEffect, useMemo, useState } from "react";
import axios from "axios";

import AdminPopup from "./AdminPopup";

function RolePermissionsPage({ embedded = false }) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5075";
  const token = localStorage.getItem("token");

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState([]);

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState([]);

  const [popup, setPopup] = useState({
    open: false,
    title: "",
    text: "",
    onConfirm: null,
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const [
        rolesResponse,
        permissionsResponse,
        rolePermissionsResponse,
      ] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/roles`, config),
        axios.get(`${API_BASE_URL}/api/permissions`, config),
        axios.get(
          `${API_BASE_URL}/api/rolepermissions`,
          config
        ),
      ]);

      setRoles(rolesResponse.data);
      setPermissions(permissionsResponse.data);
      setRolePermissions(rolePermissionsResponse.data);
    } catch (error) {
      console.error("Rol-yetki verileri alınamadı:", error);
      showInfo(
        "Hata",
        "Rol-yetki verileri alınırken bir hata oluştu."
      );
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

  const togglePermission = (permissionId) => {
    setSelectedPermissionIds((current) => {
      if (current.includes(permissionId)) {
        return current.filter((id) => id !== permissionId);
      }

      return [...current, permissionId];
    });
  };

  const getAlreadyAssignedPermissionIds = () => {
    return rolePermissions
      .filter(
        (item) =>
          Number(item.roleId) === Number(selectedRoleId)
      )
      .map((item) => Number(item.permissionId));
  };

  const assignPermissions = async () => {
    if (!selectedRoleId) {
      showInfo("Eksik Bilgi", "Önce bir rol seçiniz.");
      return;
    }

    if (selectedPermissionIds.length === 0) {
      showInfo("Eksik Bilgi", "En az bir yetki seçiniz.");
      return;
    }

    const alreadyAssignedIds = getAlreadyAssignedPermissionIds();

    const idsToAssign = selectedPermissionIds.filter(
      (permissionId) =>
        !alreadyAssignedIds.includes(Number(permissionId))
    );

    if (idsToAssign.length === 0) {
      showInfo(
        "Mevcut Atama",
        "Seçtiğiniz yetkilerin tamamı bu role zaten atanmış."
      );
      return;
    }

    try {
      await Promise.all(
        idsToAssign.map((permissionId) =>
          axios.post(
            `${API_BASE_URL}/api/rolepermissions`,
            {
              roleId: Number(selectedRoleId),
              permissionId: Number(permissionId),
            },
            config
          )
        )
      );

      setSelectedPermissionIds([]);
      await loadAllData();

      showInfo(
        "Başarılı",
        `${idsToAssign.length} yetki role atandı.`
      );
    } catch (error) {
      console.error("Yetkiler atanamadı:", error);
      showInfo(
        "Hata",
        "Yetkiler atanırken bir hata oluştu."
      );
    }
  };

  const deleteRolePermission = (item) => {
    showConfirm(
      "Yetkiyi Kaldır",
      `${item.permissionName} yetkisi ${item.roleName} rolünden kaldırılsın mı?`,
      async () => {
        try {
          await axios.delete(
            `${API_BASE_URL}/api/rolepermissions/${item.id}`,
            config
          );

          closePopup();
          await loadAllData();
        } catch (error) {
          console.error("Rol yetkisi kaldırılamadı:", error);
          closePopup();
          showInfo(
            "Hata",
            "Yetki rolden kaldırılırken bir hata oluştu."
          );
        }
      }
    );
  };

  const groupedList = useMemo(() => {
    const grouped = {};

    roles.forEach((role) => {
      grouped[role.id] = {
        roleId: role.id,
        roleName: role.name,
        permissions: [],
      };
    });

    rolePermissions.forEach((item) => {
      if (!grouped[item.roleId]) {
        grouped[item.roleId] = {
          roleId: item.roleId,
          roleName: item.roleName,
          permissions: [],
        };
      }

      grouped[item.roleId].permissions.push(item);
    });

    return Object.values(grouped);
  }, [roles, rolePermissions]);

  const alreadyAssignedPermissionIds =
    getAlreadyAssignedPermissionIds();

  return (
    <div style={pageStyles.page}>
      {!embedded && (
        <h1 style={pageStyles.pageTitle}>
          Rol-Yetki Yönetimi
        </h1>
      )}

      <div style={pageStyles.assignmentPanel}>
        <h2 style={pageStyles.panelTitle}>
          Role Yetki Ata
        </h2>

        <div style={pageStyles.formRow}>
          <select
            style={pageStyles.select}
            value={selectedRoleId}
            onChange={(event) => {
              setSelectedRoleId(event.target.value);
              setSelectedPermissionIds([]);
            }}
          >
            <option value="">Rol seçiniz</option>

            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
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

        <div style={pageStyles.permissionPicker}>
          {permissions.map((permission) => {
            const permissionId = Number(permission.id);
            const isSelected =
              selectedPermissionIds.includes(permissionId);
            const isAlreadyAssigned =
              alreadyAssignedPermissionIds.includes(permissionId);

            return (
              <button
                key={permission.id}
                type="button"
                disabled={!selectedRoleId || isAlreadyAssigned}
                onClick={() => togglePermission(permissionId)}
                style={{
                  ...pageStyles.permissionChoice,
                  ...(isSelected
                    ? pageStyles.permissionChoiceSelected
                    : {}),
                  ...(isAlreadyAssigned
                    ? pageStyles.permissionChoiceAssigned
                    : {}),
                  ...(!selectedRoleId
                    ? pageStyles.permissionChoiceDisabled
                    : {}),
                }}
              >
                <span>{permission.name}</span>

                {isAlreadyAssigned && (
                  <span style={pageStyles.assignedText}>
                    Atanmış
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={pageStyles.roleGrid}>
        {groupedList.map((item) => (
          <div
            key={item.roleId}
            style={pageStyles.roleCard}
          >
            <div style={pageStyles.roleHeader}>
              <div>
                <h3 style={pageStyles.roleName}>
                  {item.roleName}
                </h3>

                <p style={pageStyles.permissionCount}>
                  {item.permissions.length} yetki
                </p>
              </div>
            </div>

            <div style={pageStyles.permissionList}>
              {item.permissions.length > 0 ? (
                item.permissions.map((permission) => (
                  <div
                    key={permission.id}
                    style={pageStyles.permissionRow}
                  >
                    <span style={pageStyles.permissionName}>
                      {permission.permissionName}
                    </span>

                    <button
                      type="button"
                      style={pageStyles.removeButton}
                      onClick={() =>
                        deleteRolePermission(permission)
                      }
                    >
                      Kaldır
                    </button>
                  </div>
                ))
              ) : (
                <div style={pageStyles.emptyText}>
                  Bu role henüz yetki atanmamış.
                </div>
              )}
            </div>
          </div>
        ))}
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
    fontSize: 28,
    color: "#ffffff",
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

  formRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },

  select: {
    minWidth: 230,
    height: 38,
    padding: "8px 11px",
    borderRadius: 9,
    border: "1px solid rgba(148,163,184,0.24)",
    outline: "none",
    background: "rgba(15,23,42,0.86)",
    color: "#ffffff",
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

  permissionPicker: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fill, minmax(170px, 1fr))",
    gap: 8,
  },

  permissionChoice: {
    minHeight: 40,
    padding: "8px 10px",
    borderRadius: 9,
    border: "1px solid rgba(96,165,250,0.14)",
    background: "rgba(15,31,67,0.58)",
    color: "#cbd5e1",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  permissionChoiceSelected: {
    border: "1px solid rgba(96,165,250,0.44)",
    background: "rgba(37,99,235,0.18)",
    color: "#ffffff",
    boxShadow: "0 0 0 2px rgba(37,99,235,0.08)",
  },

  permissionChoiceAssigned: {
    border: "1px solid rgba(74,222,128,0.15)",
    background: "rgba(22,101,52,0.12)",
    color: "#86efac",
    cursor: "not-allowed",
  },

  permissionChoiceDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },

  assignedText: {
    fontSize: 9,
    color: "#86efac",
    fontWeight: 800,
  },

  roleGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fill, minmax(270px, 1fr))",
    gap: 12,
  },

  roleCard: {
    minHeight: 150,
    padding: 15,
    borderRadius: 14,
    background: "rgba(8,18,55,0.68)",
    border: "1px solid rgba(96,165,250,0.13)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },

  roleHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottom:
      "1px solid rgba(96,165,250,0.1)",
  },

  roleName: {
    margin: 0,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 900,
  },

  permissionCount: {
    margin: "4px 0 0",
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: 700,
  },

  permissionList: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },

  permissionRow: {
    minHeight: 36,
    padding: "7px 9px",
    borderRadius: 9,
    background: "rgba(15,31,67,0.6)",
    border: "1px solid rgba(96,165,250,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  permissionName: {
    color: "#dbeafe",
    fontSize: 11,
    fontWeight: 700,
  },

  removeButton: {
    flexShrink: 0,
    minHeight: 27,
    padding: "5px 8px",
    borderRadius: 7,
    border: "1px solid rgba(248,113,113,0.24)",
    background: "rgba(127,29,29,0.1)",
    color: "#fca5a5",
    cursor: "pointer",
    fontSize: 9,
    fontWeight: 800,
  },

  emptyText: {
    padding: 15,
    borderRadius: 10,
    background: "rgba(15,31,67,0.38)",
    color: "#8090aa",
    textAlign: "center",
    fontSize: 10,
    fontWeight: 600,
  },
};

export default RolePermissionsPage;
