const styles = {
  page: {
    width: "100%",
    height: "100vh",
    position: "relative",
    overflow: "hidden",
  },

  topbar: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "64px",
    zIndex: 1000,
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) auto minmax(180px, 1fr)",
    alignItems: "center",
    padding: "0 14px",
    background: "linear-gradient(90deg, #031126 0%, #061731 55%, #041126 100%)",
    borderBottom: "1px solid rgba(96,165,250,0.18)",
    boxShadow: "0 8px 26px rgba(2,6,23,0.30)",
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' 
  },

  topbarLeftSpacer: {
    minWidth: 0,
  },

  leftSearchSlot: {
    gridColumn: 1,
    justifySelf: "start",
    width: "min(330px, 100%)",
    minWidth: "44px",
    display: "flex",
    alignItems: "center",
    position: "relative",
    overflow: "visible",
    zIndex: 3200,
  },











  toolIcon: {
    width: "22px",
    height: "22px",
    color: "currentColor",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },

  userChevron: {
    marginLeft: "4px",
    color: "#94a3b8",
    fontSize: "16px",
  },

  centerTools: {
    gridColumn: 2,
    height: "100%",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "center",
    gap: 0,
    padding: 0,
    background: "transparent",
    border: "none",
    boxShadow: "none"
  },

  rightTools: {
    gridColumn: 3,
    justifySelf: "end",
    height: "100%",
    display: "flex",
    alignItems: "center",
    gap: "10px" 
  },

  layerMenuWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },

  iconToolButton: {
    height: "64px",
    minWidth: "58px",
    padding: "7px 6px 6px",
    borderRadius: 0,
    border: "none",
    borderBottom: "3px solid transparent",
    background: "transparent",
    color: "#d9e5f5",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "3px",
    cursor: "pointer",
    transition: "color .16s ease, background .16s ease, border-color .16s ease",
    boxShadow: "none",
    flexShrink: 0,
    whiteSpace: "nowrap" 
  },

  activeIconToolButton: {
    background: "linear-gradient(180deg, rgba(37,99,235,0.04), rgba(37,99,235,0.13))",
    color: "#2f91ff",
    borderBottom: "3px solid #2f91ff",
    boxShadow: "none",
    transform: "none" 
  },

  toolIconImage: {
    display: "none",
  },

  toolLabel: {
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0",
    lineHeight: 1.1,
    whiteSpace: "nowrap"
  },

  toolbarDivider: {
    width: "1px",
    height: "26px",
    margin: 0,
    background: "rgba(148,163,184,0.22)",
  },

  iconDropdown: {
    position: "absolute",
    top: "64px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "178px",
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    background: "rgba(7,20,48,0.98)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    borderRadius: "0 0 12px 12px",
    border: "1px solid rgba(96,165,250,0.18)",
    borderTop: "none",
    boxShadow: "0 18px 42px rgba(2,6,23,0.42)",
    zIndex: 3000,
  },

  iconDropdownButton: {
    width: "100%",
    height: "36px",
    padding: "0 10px",
    borderRadius: "8px",
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(30,48,84,0.82)",
    color: "#e5efff",
    fontSize: "13px",
    fontWeight: "800",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    cursor: "pointer",
    textAlign: "left",
  },

  iconLayerItem: {
    minHeight: "36px",
    padding: "0 9px",
    borderRadius: "8px",
    background: "rgba(30,48,84,0.65)",
    color: "#e5efff",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    fontWeight: "800",
    cursor: "pointer",
  },

  pointMiniIcon: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#60a5fa",
    boxShadow: "0 0 0 2px rgba(96,165,250,0.18)",
    flexShrink: 0,
  },

  lineMiniIcon: {
    width: "18px",
    height: "2px",
    borderRadius: "999px",
    background: "#60a5fa",
    transform: "rotate(-35deg)",
    flexShrink: 0,
  },

  polygonMiniIcon: {
    width: "18px",
    color: "#60a5fa",
    fontSize: "17px",
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  layerCheckbox: {
    width: "15px",
    height: "15px",
    cursor: "pointer",
    accentColor: "#3b82f6",
  },

  menuChevron: {
    position: "absolute",
    right: "4px",
    top: "33px",
    color: "#8aa4c4",
    fontSize: "7px",
    lineHeight: 1 
  },

  combinedMapDropdown: {
    position: "absolute",
    top: "64px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "224px",
    padding: "9px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    background: "rgba(7,20,48,0.99)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    borderRadius: "0 0 13px 13px",
    border: "1px solid rgba(96,165,250,0.20)",
    borderTop: "none",
    boxShadow: "0 18px 42px rgba(2,6,23,0.44)",
    zIndex: 3000,
  },

  transitCompactDropdown: {
    position: "absolute",
    top: "64px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "224px",
    padding: "9px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    background: "rgba(7,20,48,0.99)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    borderRadius: "0 0 13px 13px",
    border: "1px solid rgba(96,165,250,0.20)",
    borderTop: "none",
    boxShadow: "0 18px 42px rgba(2,6,23,0.44)",
    zIndex: 3000,
  },

  dropdownSectionTitle: {
    padding: "3px 6px 7px",
    color: "#8fb8f4",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
  },

  combinedLayerRow: {
    minHeight: "40px",
    display: "grid",
    gridTemplateColumns: "1fr 34px",
    alignItems: "center",
    gap: "7px",
    padding: "4px 5px 4px 9px",
    borderRadius: "9px",
    background: "rgba(30,48,84,0.70)",
    border: "1px solid rgba(148,163,184,0.10)",
  },

  combinedLayerVisibility: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "9px",
    color: "#e5efff",
    fontSize: "13px",
    fontWeight: "800",
    cursor: "pointer",
  },

  addGeometryButton: {
    width: "32px",
    height: "32px",
    padding: 0,
    borderRadius: "8px",
    border: "1px solid rgba(96,165,250,0.38)",
    background: "rgba(37,99,235,0.22)",
    color: "#93c5fd",
    fontSize: "21px",
    fontWeight: "500",
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },

  analysisDropdown: {
    position: "absolute",
    top: "64px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "245px",
    padding: "9px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    background: "rgba(7,20,48,0.99)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    borderRadius: "0 0 13px 13px",
    border: "1px solid rgba(96,165,250,0.20)",
    borderTop: "none",
    boxShadow: "0 18px 42px rgba(2,6,23,0.44)",
    zIndex: 3000,
  },

  analysisMenuItem: {
    width: "100%",
    minHeight: "40px",
    padding: "0 12px",
    borderRadius: "9px",
    border: "1px solid rgba(148,163,184,0.10)",
    background: "rgba(30,48,84,0.70)",
    color: "#e5efff",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    cursor: "pointer",
    textAlign: "left",
  },

  activeAnalysisMenuItem: {
    background: "rgba(37,99,235,0.25)",
    border: "1px solid rgba(96,165,250,0.38)",
  },

  analysisMenuIcon: {
    width: "27px",
    minWidth: "27px",
    height: "27px",
    borderRadius: "8px",
    background: "rgba(37,99,235,0.18)",
    color: "#93c5fd",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
  },

  analysisMenuText: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    color: "#e5efff",
  },

  analysisMenuTitle: {
    color: "#e5efff",
    fontSize: "13px",
    fontWeight: "800",
    lineHeight: 1,
  },

  dropdownSeparator: {
    height: "1px",
    margin: "5px 4px",
    background: "rgba(148,163,184,0.20)",
  },

  userMenuWrapper: {
    position: "relative",
  },

  compactUserButton: {
    height: "42px",
    minWidth: "138px",
    padding: "4px 12px 4px 6px",
    borderRadius: "12px",
    border: "1px solid rgba(148,163,184,0.10)",
    background: "transparent",
    color: "#f8fafc",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    cursor: "pointer" 
  },

  compactAvatarImage: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    objectFit: "cover",
    display: "block",
    flexShrink: 0,
    border: "1px solid rgba(147,197,253,0.55)",
  },

  compactAvatarFallback: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2563eb, #3b82f6)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "900",
    fontSize: "12px",
    flexShrink: 0,
  },

  compactUsername: {
    maxWidth: "105px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1,
  },

  userDropdown: {
    position: "absolute",
    top: "45px",
    right: 0,
    width: "210px",
    padding: "12px",
    borderRadius: "0 0 12px 12px",
    background: "rgba(7,18,42,0.99)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    border: "1px solid rgba(96,165,250,0.16)",
    borderTop: "none",
    boxShadow: "0 16px 36px rgba(2,6,23,0.38)",
    color: "white",
    zIndex: 3000,
  },

  dropdownRow: {
    fontSize: "13px",
    fontWeight: "800",
    marginBottom: "11px",
    color: "#e5e7eb",
  },

  dropdownLogout: {
    width: "100%",
    height: "38px",
    borderRadius: "9px",
    border: "none",
    background: "rgba(239,68,68,0.95)",
    color: "white",
    fontSize: "13px",
    fontWeight: "900",
    cursor: "pointer",
  },

  profilePanel: {
    background: "rgba(15,23,42,0.92)",
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: "12px",
    padding: "11px",
    marginBottom: "11px",
    color: "white",
  },

  profileHeader: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    marginBottom: "11px",
  },

  profileLargeImage: {
    width: "50px",
    height: "50px",
    borderRadius: "50%",
    objectFit: "cover",
    border: "2px solid rgba(96,165,250,0.8)",
  },

  profileLargeFallback: {
    width: "50px",
    height: "50px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2563eb, #60a5fa)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "900",
    fontSize: "20px",
  },

  profileFileInput: {
    width: "100%",
    color: "#cbd5e1",
    marginBottom: "10px",
  },

  profileSaveButton: {
    width: "100%",
    border: "none",
    borderRadius: "9px",
    padding: "10px 12px",
    background: "#22c55e",
    color: "white",
    fontWeight: "800",
    cursor: "pointer",
  },

  map: {
    width: "100%",
    height: "100vh",
  },

 confirmOverlay: {
  position: "fixed",
  inset: 0,
  zIndex: 99999,
  background: "rgba(15,23,42,0.55)",
  backdropFilter: "blur(5px)",
  WebkitBackdropFilter: "blur(5px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
},
overlay: {
  position: "fixed",
  inset: 0,
  zIndex: 2000,
  background: "rgba(15,23,42,0.25)",
  backdropFilter: "blur(2px)",
  WebkitBackdropFilter: "blur(2px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  pointerEvents: "none",
},
confirmBox: {
  width: "360px",
  padding: "22px",
  borderRadius: "18px",
  background: "linear-gradient(180deg, #151c2b 0%, #0f1724 100%)",
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
  color: "white",
},

confirmTitle: {
  fontSize: "20px",
  fontWeight: "900",
  margin: "0 0 10px 0",
  color: "#ffffff",
},

confirmText: {
  fontSize: "15px",
  color: "#cbd5e1",
  lineHeight: "1.5",
  margin: "0 0 20px 0",
},

confirmButtons: {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
},

confirmCancel: {
  height: "42px",
  borderRadius: "10px",
  border: "1px solid rgba(148,163,184,0.25)",
  background: "#1f2937",
  color: "white",
  fontSize: "15px",
  fontWeight: "800",
  cursor: "pointer",
},

confirmDelete: {
  height: "42px",
  borderRadius: "10px",
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(127,29,29,0.55)",
  color: "#fca5a5",
  fontSize: "15px",
  fontWeight: "800",
  cursor: "pointer",
},
editFloatingActions: {
  position: "absolute",
  bottom: "28px",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 4000,
  display: "flex",
  gap: "12px",
  padding: "12px",
  borderRadius: "16px",
  background: "rgba(15,23,42,0.92)",
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
},

editSaveButton: {
  height: "42px",
  padding: "0 20px",
  borderRadius: "10px",
  border: "none",
  background: "#2563eb",
  color: "white",
  fontSize: "15px",
  fontWeight: "900",
  cursor: "pointer",
},

editCancelButton: {
  height: "42px",
  padding: "0 20px",
  borderRadius: "10px",
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(127,29,29,0.55)",
  color: "#fca5a5",
  fontSize: "15px",
  fontWeight: "900",
  cursor: "pointer",
},
popup: {
  width: "360px",
  background: "linear-gradient(180deg, #151c2b 0%, #0f1724 100%)",
  borderRadius: "18px",
  padding: "18px",
  boxShadow: "0 22px 55px rgba(0,0,0,0.45)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "white",

  pointerEvents: "auto",
},

  popupTitle: {
    fontSize: "20px",
    fontWeight: "900",
    marginBottom: "14px",
    color: "#ffffff",
    textAlign: "left",
  },

  divider: {
    height: "1px",
    background: "rgba(255,255,255,0.12)",
    marginBottom: "16px",
  },

  label: {
    fontSize: "13px",
    fontWeight: "800",
    marginBottom: "6px",
    color: "#e5e7eb",
  },

  input: {
    width: "100%",
    height: "38px",
    borderRadius: "8px",
    border: "1px solid rgba(148,163,184,0.28)",
    padding: "0 10px",
    fontSize: "13px",
    marginBottom: "14px",
    outline: "none",
    boxSizing: "border-box",
    background: "#1f2937",
    color: "white",
  },
overlapList: {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  marginBottom: "16px",
},

overlapItem: {
  width: "100%",
  padding: "14px 18px",
  marginBottom: "12px",
  borderRadius: "10px",
  border: "1px solid rgba(148,163,184,0.25)",
  background: "#1f2937",
  color: "white",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontWeight: "600",
  fontSize: "15px",
},
  formRow: {
    display: "flex",
    gap: "14px",
    alignItems: "flex-start",
    marginBottom: "14px",
  },

  colorColumn: {
    width: "82px",
    flexShrink: 0,
  },

  noteColumn: {
    flex: 1,
  },

  colorInput: {
    width: "70px",
    height: "38px",
    borderRadius: "8px",
    border: "1px solid rgba(148,163,184,0.35)",
    padding: "4px",
    background: "#1f2937",
    cursor: "pointer",
  },

  readonlyColor: {
    width: "70px",
    height: "38px",
    borderRadius: "8px",
    border: "1px solid rgba(148,163,184,0.35)",
    padding: "4px",
    background: "#1f2937",
  },

  textarea: {
    width: "100%",
    height: "38px",
    borderRadius: "8px",
    border: "1px solid rgba(148,163,184,0.28)",
    padding: "9px 10px",
    fontSize: "13px",
    resize: "none",
    outline: "none",
    boxSizing: "border-box",
    background: "#1f2937",
    color: "white",
  },

  infoCard: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  minHeight: "44px",
  padding: "0 14px",
  borderRadius: "10px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(148,163,184,0.22)",
  marginBottom: "14px",
},

infoLabel: {
  fontSize: "13px",
  fontWeight: "800",
  color: "#93c5fd",
},

infoValue: {
  fontSize: "15px",
  fontWeight: "900",
  color: "#ffffff",
},

  infoLabel: {
    fontSize: "12px",
    fontWeight: "800",
    color: "#93c5fd",
    marginBottom: "5px",
  },

  infoValue: {
    fontSize: "14px",
    fontWeight: "900",
    color: "#ffffff",
    wordBreak: "break-word",
  },

  noteBox: {
    width: "100%",
    minHeight: "38px",
    borderRadius: "8px",
    border: "1px solid rgba(148,163,184,0.28)",
    padding: "9px 10px",
    fontSize: "13px",
    boxSizing: "border-box",
    background: "#1f2937",
    color: "white",
    lineHeight: "1.35",
    wordBreak: "break-word",
  },
searchIconButton: {
  width: "76px",
  minWidth: "76px",
  height: "42px",
  padding: "0 12px",
  borderRadius: "11px",
  fontSize: "14px",
},
  analysisRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "9px 0",
    fontSize: "14px",
    fontWeight: "700",
    color: "#e5e7eb",
    gap: "16px",
  },

  analysisValue: {
    color: "#93c5fd",
    fontWeight: "900",
    textAlign: "right",
    maxWidth: "220px",
    wordBreak: "break-word",
  },

  analysisTotal: {
    marginTop: "10px",
    padding: "11px 12px",
    borderRadius: "10px",
    background: "rgba(59,130,246,0.15)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "14px",
    fontWeight: "900",
    color: "#93c5fd",
  },
 editModeBanner: {
  position: "absolute",
  top: "66px",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 4000,

  minWidth: "420px",
  padding: "16px 24px",

  background: "rgba(15, 23, 42, 0.96)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",

  border: "1px solid rgba(255,255,255,0.08)",
  borderTop: "3px solid #3b82f6",
  borderRadius: "14px",

  color: "#f8fafc",
  boxShadow: "0 16px 40px rgba(0,0,0,.35)",

  textAlign: "center",
},

editModeIcon: {
  display: "none",
},

editModeTitle: {
  fontSize: "16px",
  fontWeight: "800",
  marginBottom: "4px",
},

editModeDesc: {
  fontSize: "13px",
  fontWeight: "600",
  color: "#cbd5e1",
},

editModeIcon:{
    fontSize:"24px"
},

editModeText:{
    display:"flex",
    flexDirection:"column",
},

editModeTitle:{
    fontSize:"17px",
    fontWeight:"800",
},

editModeDesc:{
    fontSize:"13px",
    marginTop:"2px"
},
overlapTitle: {
  textAlign: "center",
  color: "white",
  fontSize: "20px",
  fontWeight: "700",
  marginBottom: "22px",
},

overlapCloseWrapper: {
  display: "flex",
  justifyContent: "center",
  marginTop: "22px",
},

overlapCloseButton: {
  width: "120px",
  height: "42px",
  borderRadius: "10px",
  border: "none",
  background: "#dc2626",
  color: "white",
  fontWeight: "700",
  fontSize: "15px",
  cursor: "pointer",
  transition: "0.2s",
},
  resultTitle: {
    fontSize: "17px",
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: "12px",
  },

popupButtons: {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "12px",
  marginTop: "20px",
  width: "100%",
},

button: {
  minWidth: 0,
  height: "44px",
  padding: "0 18px",
  borderRadius: "10px",
  fontSize: "15px",
  fontWeight: "800",
  lineHeight: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxSizing: "border-box",
  transition:
    "transform .15s ease, background .15s ease, border-color .15s ease, opacity .15s ease",
},

cancelButton: {
  background: "#1f2937",
  color: "white",
  border: "1px solid rgba(148,163,184,0.30)",
  flex: 1,
  minWidth: "130px",
  height: "44px",
},

saveButton: {
  background: "#2563eb",
  color: "white",
  border: "1px solid rgba(96,165,250,0.34)",
  flex: 1,
  minWidth: "130px",
  height: "44px",
  boxShadow: "0 8px 20px rgba(37,99,235,0.22)",
},

editButton: {
  background: "#1f2937",
  color: "white",
  border: "1px solid rgba(148,163,184,0.25)",
  width: "100%",
  height: "42px",
  borderRadius: "10px",
  fontSize: "15px",
  fontWeight: "700",
  cursor: "pointer",
  padding: 0,
},
successToast: {
  position: "absolute",
  top: "66px",
  left: "50%",
  transform: "translateX(-50%)",

  zIndex: 5000,

  minWidth: "320px",
  padding: "14px 26px",

  textAlign: "center",

  background: "rgba(15, 23, 42, 0.96)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",

  border: "1px solid rgba(255,255,255,0.08)",
  borderTop: "3px solid #3b82f6",

  borderRadius: "14px",

  color: "#f8fafc",
  fontSize: "15px",
  fontWeight: "700",

  boxShadow: "0 16px 40px rgba(0,0,0,.35)",

  letterSpacing: "0.2px",

  animation: "fadeDown .25s ease",
},

primaryButton: {
  minWidth: "140px",
  height: "44px",
  border: "none",
  borderRadius: "10px",
  background: "#2563eb",
  color: "#fff",
  fontWeight: "700",
  fontSize: "15px",
  cursor: "pointer",
},

deleteButton: {
  background: "rgba(127,29,29,0.35)",
  color: "#fca5a5",
  border: "1px solid rgba(248,113,113,0.35)",
  width: "100%",
  height: "42px",
  borderRadius: "10px",
  fontSize: "15px",
  fontWeight: "700",
  cursor: "pointer",
  padding: 0,
},

closeButton: {
  background: "#2563eb",
  color: "white",
  border: "none",
  width: "100%",
  height: "42px",
  borderRadius: "10px",
  fontSize: "15px",
  fontWeight: "700",
  cursor: "pointer",
  padding: 0,
},
  disabledButton: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
};

export default styles;