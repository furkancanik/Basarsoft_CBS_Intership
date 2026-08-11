import { useEffect, useMemo, useState } from "react";
import axios from "axios";

import GeographicAuthorizationsPage from "./Admin/GeographicAuthorizationsPage";
import UsersPage from "./Admin/UsersPage";
import RolesPermissionsPage from "./Admin/RolesPermissionsPage";
import UserAssignmentsPage from "./Admin/UserAssignmentsPage";
import PoiCategoriesPage from "./Admin/PoiCategoriesPage";
import PoisPage from "./Admin/PoisPage";


import styles from "./Admin/AdminStyles";
import adminBackground from "../assets/admin-background.jpg";

function AdminPage() {
  const [activePage, setActivePage] = useState("users");
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [accessMode, setAccessMode] = useState("");

  const API_BASE_URL = "http://localhost:5075";
  const token = localStorage.getItem("token");

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const normalize = (value) =>
    String(value || "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .replace(/\s/g, "")
      .replace(/[._-]/g, "")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ç/g, "c");

  useEffect(() => {
    checkPageAccess();
  }, []);

  const getUsernameFromToken = () => {
    try {
      if (!token) return "";

      const payload = JSON.parse(atob(token.split(".")[1]));

      return (
        payload[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
        ] ||
        payload.unique_name ||
        payload.name ||
        ""
      );
    } catch (error) {
      console.log("Token okunamadı:", error);
      return "";
    }
  };

  const checkPageAccess = async () => {
    try {
      if (!token) {
        window.location.href = "/login";
        return;
      }

      const username = getUsernameFromToken();

      if (!username) {
        window.location.href = "/login";
        return;
      }

      const response = await axios.get(
        `${API_BASE_URL}/api/userroles`,
        config
      );

      const roleRecords = Array.isArray(response.data)
        ? response.data.filter((item) => {
            const itemUsername = item.username ?? item.userName;
            return normalize(itemUsername) === normalize(username);
          })
        : [];

      const roleNames = roleRecords.map((item) =>
        normalize(item.roleName)
      );

      const hasAdminRole = roleNames.includes(normalize("Admin"));

      const hasOperatorRole = [
        "Operator",
        "Operatör",
        "Ulaşım Operatörü",
        "Ulasim Operatoru",
      ].some((roleName) =>
        roleNames.includes(normalize(roleName))
      );

      if (hasAdminRole) {
        setAccessMode("admin");

        setIsCheckingAccess(false);
        return;
      }

      if (hasOperatorRole) {
        alert("Güzergah yönetimi harita sayfasına taşındı.");
        window.location.href = "/map";
        return;
      }

      alert(
        "Bu alana sadece Admin rolüne sahip kullanıcılar girebilir."
      );
      window.location.href = "/map";
    } catch (error) {
      console.log("Yönetim erişim kontrolü yapılamadı:", error);
      window.location.href = "/map";
    }
  };

  const menuItems = useMemo(() => {
    if (accessMode === "operator") {
      return [
        
      ];
    }

    return [
      {
        key: "users",
        label: "👤 Kullanıcılar",
      },
      {
        key: "rolesPermissions",
        label: "🛡 Roller ve Yetkiler",
      },
      {
        key: "userAssignments",
        label: "👥 Kullanıcı Atamaları",
      },
      {
        key: "geoAuth",
        label: "🗺 Coğrafi Yetki",
      },
      {
        key: "pois",
        label: "📌 POI Yönetimi",
      },
      {
        key: "poiCategories",
        label: "📍 POI Kategori Yönetimi",
      },
    ];
  }, [accessMode]);

  const changeActivePage = (pageKey) => {
    setActivePage(pageKey);
    window.history.replaceState({}, "", "/admin");
  };

  const renderActivePage = () => {
    switch (activePage) {
      case "users":
        return <UsersPage />;

      case "rolesPermissions":
        return <RolesPermissionsPage />;

      case "userAssignments":
        return <UserAssignmentsPage />;

      case "geoAuth":
        return <GeographicAuthorizationsPage />;

      case "pois":
        return <PoisPage />;



      case "poiCategories":
        return <PoiCategoriesPage />;

      default:
        return <UsersPage />;
    }
  };

  const rootStyle = {
    ...styles.page,
    backgroundImage: `url(${adminBackground})`,
  };

  if (isCheckingAccess) {
    return (
      <div style={rootStyle}>
        <div style={styles.backgroundOverlay} />

        <main
          style={{
            ...styles.content,
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              zIndex: 2,
              padding: "18px 25px",
              borderRadius: 13,
              background: "rgba(8,18,55,0.86)",
              border: "1px solid rgba(96,165,250,0.22)",
              color: "#ffffff",
              fontSize: 16,
              fontWeight: 800,
              boxShadow: "0 20px 50px rgba(0,0,0,0.38)",
              backdropFilter: "blur(12px)",
            }}
          >
            Yetki kontrol ediliyor...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-page-root" style={rootStyle}>
      <div style={styles.backgroundOverlay} />

      <style>
        {`
          .admin-page-root,
          .admin-page-root * {
            box-sizing: border-box;
          }

          .admin-content h1 {
            color: #ffffff !important;
            text-shadow: 0 5px 20px rgba(0,0,0,0.55);
          }

          .admin-content h2,
          .admin-content h3 {
            color: #f4f8ff !important;
          }

          .admin-content table {
            background: transparent !important;
          }

          .admin-content thead,
          .admin-content thead tr,
          .admin-content th {
            background: rgba(10,20,50,0.94) !important;
            color: #e5efff !important;
          }

          .admin-content tbody,
          .admin-content tbody tr {
            background: transparent !important;
          }

          .admin-content td {
            background: rgba(15,31,67,0.82) !important;
            color: #e7efff !important;
            border-color: rgba(148,163,184,0.10) !important;
          }

          .admin-content input,
          .admin-content textarea,
          .admin-content select {
            background: rgba(15,23,42,0.88) !important;
            color: #f8fafc !important;
            border-color: rgba(148,163,184,0.28) !important;
          }

          .admin-content input::placeholder,
          .admin-content textarea::placeholder {
            color: #8997af !important;
          }

          .admin-content select option {
            background: #0f172a;
            color: #ffffff;
          }

          .admin-content > div {
            background-color: transparent !important;
          }

          .admin-content ::-webkit-scrollbar {
            width: 7px;
            height: 7px;
          }

          .admin-content ::-webkit-scrollbar-track {
            background: rgba(15,23,42,0.4);
          }

          .admin-content ::-webkit-scrollbar-thumb {
            background: rgba(96,165,250,0.42);
            border-radius: 20px;
          }

          @media (max-width: 900px) {
            .admin-sidebar {
              width: 155px !important;
              min-width: 155px !important;
            }

            .admin-content {
              padding: 18px 14px 24px 2px !important;
            }
          }
        `}
      </style>

      <aside className="admin-sidebar" style={styles.sidebar}>
        <h2 style={styles.title}>
          Yönetim

          <span style={styles.titleSmall}>
            İşlem Ataması
          </span>
        </h2>

        <div style={styles.navContainer}>
          {menuItems.map((item) => {
            const isActive = activePage === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => changeActivePage(item.key)}
                style={{
                  ...styles.navButton,
                  ...(isActive
                    ? styles.activeNavButton
                    : {}),
                }}
                onMouseEnter={(event) => {
                  if (!isActive) {
                    event.currentTarget.style.background =
                      "rgba(37,99,235,0.13)";
                    event.currentTarget.style.color = "#ffffff";
                    event.currentTarget.style.transform =
                      "translateX(2px)";
                  }
                }}
                onMouseLeave={(event) => {
                  if (!isActive) {
                    event.currentTarget.style.background =
                      "transparent";
                    event.currentTarget.style.color = "#aebbd3";
                    event.currentTarget.style.transform =
                      "translateX(0)";
                  }
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          style={styles.backButton}
          onClick={() => {
            window.location.href = "/map";
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.transform =
              "translateY(-1px)";
            event.currentTarget.style.boxShadow =
              "0 14px 30px rgba(37,99,235,0.3)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.transform =
              "translateY(0)";
            event.currentTarget.style.boxShadow =
              "0 10px 25px rgba(37,99,235,0.2)";
          }}
        >
          ← Haritaya Dön
        </button>
      </aside>

      <main className="admin-content" style={styles.content}>
        <div style={styles.contentInner}>
          {renderActivePage()}
        </div>
      </main>
    </div>
  );
}

export default AdminPage;
