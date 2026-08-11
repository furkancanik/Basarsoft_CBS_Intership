import { useEffect, useState } from "react";
import axios from "axios";

import AdminPopup from "./AdminPopup";

function UserRolesPage({ embedded = false }) {
  const API_BASE_URL = "http://localhost:5075";
  const token = localStorage.getItem("token");

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [userRoles, setUserRoles] = useState([]);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");

  const [popup, setPopup] = useState({
    open: false,
    title: "",
    text: "",
    onConfirm: null,
  });

  useEffect(() => {
    loadAllData();
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

  const loadAllData = async () => {
    try {
      const [usersResponse, rolesResponse, userRolesResponse] =
        await Promise.all([
          axios.get(`${API_BASE_URL}/api/users`, config),
          axios.get(`${API_BASE_URL}/api/roles`, config),
          axios.get(`${API_BASE_URL}/api/userroles`, config),
        ]);

      setUsers(usersResponse.data);
      setRoles(rolesResponse.data);
      setUserRoles(userRolesResponse.data);
    } catch (error) {
      console.error("Kullanıcı-rol verileri alınamadı:", error);
      showInfo(
        "Hata",
        "Kullanıcı-rol verileri alınırken bir hata oluştu."
      );
    }
  };

  const assignRole = async () => {
    if (!selectedUserId || !selectedRoleId) {
      showInfo("Eksik Bilgi", "Kullanıcı ve rol seçiniz.");
      return;
    }

    const alreadyAssigned = userRoles.some(
      (item) =>
        Number(item.userId) === Number(selectedUserId) &&
        Number(item.roleId) === Number(selectedRoleId)
    );

    if (alreadyAssigned) {
      showInfo(
        "Mevcut Atama",
        "Bu rol seçilen kullanıcıya zaten atanmış."
      );
      return;
    }

    try {
      await axios.post(
        `${API_BASE_URL}/api/userroles`,
        {
          userId: Number(selectedUserId),
          roleId: Number(selectedRoleId),
        },
        config
      );

      setSelectedUserId("");
      setSelectedRoleId("");
      await loadAllData();

      showInfo("Başarılı", "Rol kullanıcıya atandı.");
    } catch (error) {
      console.error("Rol atanamadı:", error);
      showInfo("Hata", "Rol atanırken bir hata oluştu.");
    }
  };

  const deleteUserRole = (item) => {
    showConfirm(
      "Rolü Kaldır",
      `${item.roleName} rolü ${
        item.username ?? item.userName
      } kullanıcısından kaldırılsın mı?`,
      async () => {
        try {
          await axios.delete(
            `${API_BASE_URL}/api/userroles/${item.id}`,
            config
          );

          closePopup();
          await loadAllData();
        } catch (error) {
          console.error("Kullanıcı rolü kaldırılamadı:", error);
          closePopup();
          showInfo(
            "Hata",
            "Rol kullanıcıdan kaldırılırken bir hata oluştu."
          );
        }
      }
    );
  };

  return (
    <div style={pageStyles.page}>
      {!embedded && (
        <h1 style={pageStyles.pageTitle}>Kullanıcı-Rol Yönetimi</h1>
      )}

      <div style={pageStyles.assignmentPanel}>
        <h2 style={pageStyles.panelTitle}>Kullanıcıya Rol Ata</h2>

        <div style={pageStyles.formRow}>
          <select
            style={pageStyles.select}
            value={selectedUserId}
            onChange={(event) =>
              setSelectedUserId(event.target.value)
            }
          >
            <option value="">Kullanıcı seçiniz</option>

            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>

          <select
            style={pageStyles.select}
            value={selectedRoleId}
            onChange={(event) =>
              setSelectedRoleId(event.target.value)
            }
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
            onClick={assignRole}
            style={pageStyles.assignButton}
          >
            Rol Ata
          </button>
        </div>
      </div>

      <div style={pageStyles.tableWrapper}>
        <table style={pageStyles.table}>
          <thead>
            <tr>
              <th style={pageStyles.th}>Kullanıcı</th>
              <th style={pageStyles.th}>Rol</th>
              <th style={pageStyles.th}>İşlem</th>
            </tr>
          </thead>

          <tbody>
            {userRoles.map((item) => (
              <tr key={item.id}>
                <td style={pageStyles.td}>
                  {item.username ?? item.userName}
                </td>

                <td style={pageStyles.td}>
                  <span style={pageStyles.roleBadge}>
                    {item.roleName}
                  </span>
                </td>

                <td style={pageStyles.td}>
                  <button
                    type="button"
                    onClick={() => deleteUserRole(item)}
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

  formRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  select: {
    minWidth: 220,
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

  roleBadge: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: 999,
    background: "rgba(37,99,235,0.14)",
    border: "1px solid rgba(96,165,250,0.2)",
    color: "#bfdbfe",
    fontSize: 10,
    fontWeight: 800,
  },

  removeButton: {
    minHeight: 30,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(248,113,113,0.24)",
    background: "rgba(127,29,29,0.1)",
    color: "#fca5a5",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 800,
  },
};

export default UserRolesPage;
