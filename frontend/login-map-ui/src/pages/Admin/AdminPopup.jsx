function AdminPopup({
  open,
  title,
  text,
  onClose,
  onConfirm,
  confirmText = "Tamam",
  cancelText = "İptal",
  type = "warning",
  loading = false,
}) {
  if (!open) return null;

  const isDanger = type === "danger";
  const isSuccess = type === "success";

  const icon = isDanger ? "!" : isSuccess ? "✓" : "i";

  const accentColor = isDanger
    ? "#ef4444"
    : isSuccess
      ? "#22c55e"
      : "#3b82f6";

  const accentSoft = isDanger
    ? "rgba(239,68,68,0.14)"
    : isSuccess
      ? "rgba(34,197,94,0.14)"
      : "rgba(59,130,246,0.14)";

  const accentBorder = isDanger
    ? "rgba(248,113,113,0.32)"
    : isSuccess
      ? "rgba(74,222,128,0.30)"
      : "rgba(96,165,250,0.30)";

  const handleOverlayMouseDown = (event) => {
    if (event.target === event.currentTarget && !loading) {
      onClose?.();
    }
  };

  return (
    <div
      style={popupStyles.overlay}
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        style={{
          ...popupStyles.box,
          borderColor: accentBorder,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-popup-title"
      >
        <button
          type="button"
          aria-label="Pencereyi kapat"
          onClick={onClose}
          disabled={loading}
          style={popupStyles.closeButton}
        >
          ×
        </button>

        <div
          style={{
            ...popupStyles.icon,
            color: accentColor,
            background: accentSoft,
            borderColor: accentBorder,
          }}
        >
          {icon}
        </div>

        <h2 id="admin-popup-title" style={popupStyles.title}>
          {title}
        </h2>

        <p style={popupStyles.text}>{text}</p>

        <div style={popupStyles.actions}>
          {onConfirm && (
            <button
              type="button"
              style={popupStyles.cancelButton}
              onClick={onClose}
              disabled={loading}
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            style={{
              ...popupStyles.button,
              background: isDanger
                ? "rgba(185,28,28,0.96)"
                : isSuccess
                  ? "rgba(21,128,61,0.96)"
                  : "rgba(30,64,175,0.96)",
              borderColor: accentBorder,
              opacity: loading ? 0.65 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
            onClick={onConfirm ? onConfirm : onClose}
            disabled={loading}
          >
            {loading ? "İşlem yapılıyor..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

const popupStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 999999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background: "rgba(2,6,23,0.78)",
    backdropFilter: "blur(7px)",
    WebkitBackdropFilter: "blur(7px)",
  },

  box: {
    position: "relative",
    width: "min(410px, 100%)",
    boxSizing: "border-box",
    padding: "30px 28px 25px",
    borderRadius: 18,
    textAlign: "center",
    color: "#ffffff",
    background: "rgba(7,18,42,0.99)",
    border: "1px solid rgba(96,165,250,0.28)",
    boxShadow: "0 28px 75px rgba(0,0,0,0.58)",
  },

  closeButton: {
    position: "absolute",
    top: 13,
    right: 13,
    width: 32,
    height: 32,
    padding: 0,
    borderRadius: 9,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(20,38,72,0.88)",
    color: "#cbd5e1",
    fontSize: 21,
    lineHeight: 1,
    cursor: "pointer",
  },

  icon: {
    width: 54,
    height: 54,
    margin: "0 auto 17px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(96,165,250,0.28)",
    fontSize: 25,
    fontWeight: 900,
  },

  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: 22,
    lineHeight: 1.25,
    fontWeight: 900,
    letterSpacing: "-0.35px",
  },

  text: {
    margin: "11px auto 0",
    maxWidth: 330,
    color: "#aebbd3",
    fontSize: 14,
    lineHeight: 1.65,
  },

  actions: {
    marginTop: 24,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 9,
  },

  button: {
    minHeight: 42,
    padding: "9px 15px",
    borderRadius: 9,
    border: "1px solid rgba(96,165,250,0.25)",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 850,
    boxShadow: "none",
  },

  cancelButton: {
    minHeight: 42,
    padding: "9px 15px",
    borderRadius: 9,
    border: "1px solid rgba(148,163,184,0.20)",
    background: "rgba(20,38,72,0.88)",
    color: "#dbe7fb",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
};

export default AdminPopup;
