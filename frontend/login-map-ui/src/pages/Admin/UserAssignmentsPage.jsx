import { useState } from "react";

import UserRolesPage from "./UserRolesPage";
import UserPermissionsPage from "./UserPermissionsPage";

function UserAssignmentsPage() {
  const [activeTab, setActiveTab] = useState("roles");

  const tabs = [
    {
      key: "roles",
      label: "Kullanıcı-Rol",
    },
    {
      key: "permissions",
      label: "Kullanıcı-Yetki",
    },
  ];

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.header}>
        <h1 style={pageStyles.title}>Kullanıcı Atamaları</h1>

        <p style={pageStyles.subtitle}>
          Kullanıcılara rol ve doğrudan yetki atamalarını yönetin.
        </p>
      </div>

      <div style={pageStyles.tabBar}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                ...pageStyles.tabButton,
                ...(active ? pageStyles.activeTabButton : {}),
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={pageStyles.content}>
        {activeTab === "roles" ? (
          <UserRolesPage embedded />
        ) : (
          <UserPermissionsPage embedded />
        )}
      </div>
    </div>
  );
}

const pageStyles = {
  page: {
    width: "100%",
    color: "#ffffff",
  },

  header: {
    marginBottom: 12,
  },

  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: 27,
    fontWeight: 900,
    letterSpacing: "-0.7px",
  },

  subtitle: {
    margin: "5px 0 0",
    color: "#9fb0cc",
    fontSize: 11,
    fontWeight: 600,
  },

  tabBar: {
    display: "flex",
    gap: 8,
    width: "fit-content",
    marginBottom: 14,
    padding: 6,
    borderRadius: 12,
    background: "rgba(8,18,55,0.58)",
    border: "1px solid rgba(96,165,250,0.14)",
  },

  tabButton: {
    minWidth: 140,
    minHeight: 34,
    padding: "8px 13px",
    borderRadius: 8,
    border: "1px solid transparent",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
  },

  activeTabButton: {
    background: "rgba(37,99,235,0.25)",
    border: "1px solid rgba(96,165,250,0.45)",
    color: "#ffffff",
    boxShadow: "0 7px 18px rgba(37,99,235,0.18)",
  },

  content: {
    width: "100%",
  },
};

export default UserAssignmentsPage;
