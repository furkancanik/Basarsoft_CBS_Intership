import React from "react";

function ThematicMapPanel({
  open,
  themes,
  counts,
  onToggleTheme,
  onClearAll,
  onClose,
}) {
  if (!open) {
    return null;
  }

  const items = [
    {
      key: "stopHeatmap",
      title: "Durak Yoğunluğu",
      description:
        "Durakların kümelendiği bölgeleri ısı haritası olarak gösterir.",
      icon: "🔥",
      count: counts?.stops ?? 0,
      countLabel: "durak",
    },
    {
      key: "poiHeatmap",
      title: "POI Yoğunluğu",
      description:
        "POI verilerinin yoğunlaştığı alanları renkli ısı haritasına dönüştürür.",
      icon: "📍",
      count: counts?.pois ?? 0,
      countLabel: "POI",
    },
    {
      key: "walkingAccess",
      title: "Toplu Taşımaya Yürüme Erişimi",
      description:
        "Durak çevresinde 300 m, 600 m ve 1000 m erişim bölgelerini gösterir.",
      icon: "🚶",
      count: counts?.stops ?? 0,
      countLabel: "durak",
    },
    {
      key: "poiAccessibility",
      title: "POI → Durak Erişilebilirliği",
      description:
        "POI'leri en yakın toplu taşıma durağına olan mesafesine göre renklendirir.",
      icon: "🎯",
      count: counts?.pois ?? 0,
      countLabel: "POI",
    },
    {
      key: "routeCoverage",
      title: "Hat Kapsama / Hizmet Yoğunluğu",
      description:
        "Hatları, bağlı durak sayısına göre daha güçlü veya daha zayıf gösterir.",
      icon: "🚌",
      count: counts?.routes ?? 0,
      countLabel: "hat",
    },
  ];

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <div style={styles.headerTitleGroup}>
          <div style={styles.headerIcon}>◈</div>

          <div style={styles.title}>
            Tematik Harita
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={styles.closeButton}
          title="Kapat"
          aria-label="Tematik haritayı kapat"
        >
          ×
        </button>
      </div>

      <div style={styles.body}>
        <div style={styles.cards}>
          {items.map((item) => {
            const active =
              themes?.[item.key] === true;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() =>
                  onToggleTheme?.(
                    item.key,
                    !active
                  )
                }
                style={{
                  ...styles.card,
                  ...(active
                    ? styles.cardActive
                    : {}),
                }}
              >
                <div style={styles.cardTop}>
                  <div
                    style={{
                      ...styles.iconBox,
                      ...(active
                        ? styles.iconBoxActive
                        : {}),
                    }}
                  >
                    {item.icon}
                  </div>

                  <div style={styles.cardHeading}>
                    <div style={styles.cardTitle}>
                      {item.title}
                    </div>

                    <div style={styles.cardCount}>
                      {item.count} {item.countLabel}
                    </div>
                  </div>

                  <div
                    style={{
                      ...styles.switch,
                      ...(active
                        ? styles.switchActive
                        : {}),
                    }}
                  >
                    <div
                      style={{
                        ...styles.switchKnob,
                        ...(active
                          ? styles.switchKnobActive
                          : {}),
                      }}
                    />
                  </div>
                </div>

                <div style={styles.description}>
                  {item.description}
                </div>

                {item.key ===
                  "walkingAccess" && (
                  <div style={styles.legendRow}>
                    <span style={styles.legendItem}>
                      <span
                        style={{
                          ...styles.legendDot,
                          background: "#16a34a",
                        }}
                      />
                      300 m
                    </span>

                    <span style={styles.legendItem}>
                      <span
                        style={{
                          ...styles.legendDot,
                          background: "#f59e0b",
                        }}
                      />
                      600 m
                    </span>

                    <span style={styles.legendItem}>
                      <span
                        style={{
                          ...styles.legendDot,
                          background: "#ef4444",
                        }}
                      />
                      1000 m
                    </span>
                  </div>
                )}

                {item.key ===
                  "poiAccessibility" && (
                  <div style={styles.legendRow}>
                    <span style={styles.legendItem}>
                      <span
                        style={{
                          ...styles.legendDot,
                          background: "#22c55e",
                        }}
                      />
                      ≤ 500 m
                    </span>

                    <span style={styles.legendItem}>
                      <span
                        style={{
                          ...styles.legendDot,
                          background: "#f59e0b",
                        }}
                      />
                      ≤ 1000 m
                    </span>

                    <span style={styles.legendItem}>
                      <span
                        style={{
                          ...styles.legendDot,
                          background: "#ef4444",
                        }}
                      />
                      &gt; 1000 m
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClearAll}
          style={styles.clearButton}
        >
          Tüm Tematik Katmanları Temizle
        </button>
      </div>
    </div>
  );
}

const styles = {
  panel: {
    position: "absolute",
    top: 124,
    left: 18,
    width: 350,
    maxWidth: "calc(100vw - 36px)",
    maxHeight: "calc(100vh - 150px)",
    overflowY: "auto",
    zIndex: 3300,
    borderRadius: 14,
    border:
      "1px solid rgba(96,165,250,0.18)",
    background:
      "linear-gradient(160deg, rgba(3,18,40,0.985), rgba(6,29,58,0.98))",
    boxShadow:
      "0 18px 48px rgba(2,6,23,0.42)",
    color: "#f8fafc",
    backdropFilter: "blur(14px)",
  },

  header: {
    height: 54,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "8px 10px 8px 12px",
    borderBottom:
      "1px solid rgba(148,197,255,0.10)",
  },

  headerTitleGroup: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 9,
  },

  headerIcon: {
    width: 28,
    height: 28,
    flex: "0 0 28px",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "rgba(37,99,235,0.16)",
    border:
      "1px solid rgba(96,165,250,0.16)",
    color: "#7dd3fc",
    fontSize: 14,
    fontWeight: 900,
  },

  title: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: "-0.01em",
  },

  closeButton: {
    width: 30,
    height: 30,
    flex: "0 0 30px",
    padding: 0,
    borderRadius: 8,
    border:
      "1px solid rgba(148,197,255,0.16)",
    background:
      "rgba(15,39,69,0.72)",
    color: "#dbeafe",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
  },

  body: {
    padding: 9,
  },

  cards: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  card: {
    width: "100%",
    padding: "9px 10px",
    boxSizing: "border-box",
    textAlign: "left",
    borderRadius: 10,
    border:
      "1px solid rgba(148,197,255,0.10)",
    background:
      "rgba(8,28,52,0.68)",
    color: "#f8fafc",
    cursor: "pointer",
    transition:
      "border-color 160ms ease, background 160ms ease, transform 160ms ease",
  },

  cardActive: {
    border:
      "1px solid rgba(56,189,248,0.52)",
    background:
      "linear-gradient(145deg, rgba(3,105,161,0.22), rgba(8,47,73,0.74))",
    boxShadow:
      "inset 0 0 0 1px rgba(56,189,248,0.05)",
  },

  cardTop: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  iconBox: {
    width: 30,
    height: 30,
    flex: "0 0 30px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    background:
      "rgba(30,64,175,0.20)",
    fontSize: 14,
  },

  iconBoxActive: {
    background:
      "rgba(14,165,233,0.26)",
  },

  cardHeading: {
    minWidth: 0,
    flex: 1,
  },

  cardTitle: {
    color: "#ffffff",
    fontSize: 11.5,
    fontWeight: 900,
    lineHeight: 1.15,
  },

  cardCount: {
    marginTop: 2,
    color: "#7dd3fc",
    fontSize: 8.5,
    fontWeight: 800,
  },

  description: {
    marginTop: 6,
    color: "#9fb3c8",
    fontSize: 9.2,
    lineHeight: 1.35,
    fontWeight: 650,
  },

  switch: {
    width: 32,
    height: 18,
    padding: 2,
    flex: "0 0 32px",
    borderRadius: 999,
    boxSizing: "border-box",
    background:
      "rgba(71,85,105,0.66)",
  },

  switchActive: {
    background: "#0284c7",
  },

  switchKnob: {
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: "#ffffff",
    transform: "translateX(0)",
    transition:
      "transform 160ms ease",
    boxShadow:
      "0 1px 4px rgba(2,6,23,0.26)",
  },

  switchKnobActive: {
    transform: "translateX(14px)",
  },

  legendRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 9px",
    marginTop: 6,
    paddingLeft: 38,
  },

  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    color: "#cbd5e1",
    fontSize: 8.2,
    fontWeight: 800,
  },

  legendDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
  },

  clearButton: {
    width: "100%",
    minHeight: 34,
    marginTop: 8,
    borderRadius: 9,
    border:
      "1px solid rgba(248,113,113,0.18)",
    background:
      "rgba(127,29,29,0.22)",
    color: "#fecaca",
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
  },
};

export default ThematicMapPanel;
