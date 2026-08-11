import { useMemo, useState } from "react";

const MIN_CRITERIA = 2;
const MAX_CRITERIA = 5;
const REQUIRED_TOTAL_SCORE = 100;

const createEmptyCriterion = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  categoryKey: "",
  categoryId: "",
  categoryName: "",
  categoryType: "",
  score: "",
  touchedCategory: false,
  touchedScore: false,
});

function LocationAnalysisPanel({
  onClose,
  onDrawArea,
  onStartAnalysis,
  onResetAnalysis,
  areaSelected = false,
  categories = [],
}) {
  const [criteria, setCriteria] = useState([
    createEmptyCriterion(),
    createEmptyCriterion(),
  ]);
  const [message, setMessage] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const totalScore = useMemo(
    () =>
      criteria.reduce(
        (total, criterion) => total + Number(criterion.score || 0),
        0
      ),
    [criteria]
  );

  const duplicateCategoryKeys = useMemo(() => {
    const counts = new Map();

    criteria.forEach((criterion) => {
      if (!criterion.categoryKey) return;

      counts.set(
        criterion.categoryKey,
        (counts.get(criterion.categoryKey) || 0) + 1
      );
    });

    return new Set(
      [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([key]) => key)
    );
  }, [criteria]);

  const criteriaCountValid =
    criteria.length >= MIN_CRITERIA && criteria.length <= MAX_CRITERIA;

  const allCategoriesSelected = criteria.every(
    (criterion) => Boolean(criterion.categoryKey)
  );

  const allScoresValid = criteria.every((criterion) => {
    const score = Number(criterion.score);

    return (
      Number.isFinite(score) &&
      score > 0 &&
      score <= REQUIRED_TOTAL_SCORE
    );
  });

  const canStart =
    areaSelected &&
    criteriaCountValid &&
    allCategoriesSelected &&
    allScoresValid &&
    duplicateCategoryKeys.size === 0 &&
    totalScore === REQUIRED_TOTAL_SCORE &&
    !isRunning;

  const scoreProgress = Math.max(
    0,
    Math.min(100, (totalScore / REQUIRED_TOTAL_SCORE) * 100)
  );

  const scoreState =
    totalScore === REQUIRED_TOTAL_SCORE
      ? "valid"
      : totalScore > REQUIRED_TOTAL_SCORE
      ? "over"
      : "under";

  const clearMessage = () => {
    if (message) {
      setMessage("");
    }
  };

  const findSelectedCategory = (value) => {
    for (const parent of categories) {
      if (`parent:${parent.id}` === value) {
        return {
          categoryKey: value,
          categoryId: parent.id,
          categoryName: parent.name,
          categoryType: "parent",
        };
      }

      for (const child of parent.children || []) {
        if (`child:${child.id}` === value) {
          return {
            categoryKey: value,
            categoryId: child.id,
            categoryName: child.name,
            categoryType: "child",
          };
        }
      }
    }

    return null;
  };

  const addCriterion = () => {
    if (criteria.length >= MAX_CRITERIA) {
      setMessage(`En fazla ${MAX_CRITERIA} kriter ekleyebilirsin.`);
      return;
    }

    setCriteria((current) => [...current, createEmptyCriterion()]);
    setMessage("");
  };

  const removeCriterion = (criterionId) => {
    if (criteria.length <= MIN_CRITERIA) {
      setMessage(`En az ${MIN_CRITERIA} kriter bulunmalıdır.`);
      return;
    }

    setCriteria((current) =>
      current.filter((criterion) => criterion.id !== criterionId)
    );
    setMessage("");
  };

  const updateCategory = (criterionId, value) => {
    const selected = findSelectedCategory(value);

    setCriteria((current) =>
      current.map((criterion) =>
        criterion.id === criterionId
          ? {
              ...criterion,
              ...(selected || {
                categoryKey: "",
                categoryId: "",
                categoryName: "",
                categoryType: "",
              }),
              touchedCategory: true,
            }
          : criterion
      )
    );

    clearMessage();
  };

  const updateScore = (criterionId, value) => {
    let numericValue = "";

    if (value !== "") {
      const parsedValue = Number(value);

      if (Number.isFinite(parsedValue)) {
        numericValue = Math.max(
          0,
          Math.min(REQUIRED_TOTAL_SCORE, parsedValue)
        );
      }
    }

    setCriteria((current) =>
      current.map((criterion) =>
        criterion.id === criterionId
          ? {
              ...criterion,
              score: numericValue,
              touchedScore: true,
            }
          : criterion
      )
    );

    clearMessage();
  };

  const markAllTouched = () => {
    setCriteria((current) =>
      current.map((criterion) => ({
        ...criterion,
        touchedCategory: true,
        touchedScore: true,
      }))
    );
  };

  const validate = () => {
    if (!areaSelected) {
      return "Önce harita üzerinden hedef bölgeyi çizmelisin.";
    }

    if (!criteriaCountValid) {
      return `En az ${MIN_CRITERIA}, en fazla ${MAX_CRITERIA} kriter seçmelisin.`;
    }

    if (!allCategoriesSelected) {
      return "Bütün kriterlerde kategori seçmelisin.";
    }

    if (duplicateCategoryKeys.size > 0) {
      return "Aynı kategoriyi birden fazla kriterde seçemezsin.";
    }

    if (!allScoresValid) {
      return "Her kriter için 1 ile 100 arasında geçerli bir puan girmelisin.";
    }

    if (totalScore !== REQUIRED_TOTAL_SCORE) {
      return `Kriter puanlarının toplamı tam olarak ${REQUIRED_TOTAL_SCORE} olmalıdır.`;
    }

    return "";
  };

  const handleStart = async () => {
    markAllTouched();

    const validationMessage = validate();

    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    try {
      setMessage("");
      setIsRunning(true);

      await Promise.resolve(
        onStartAnalysis?.(
          criteria.map((criterion) => ({
            categoryId: criterion.categoryId,
            categoryName: criterion.categoryName,
            categoryType: criterion.categoryType,
            score: Number(criterion.score),
          }))
        )
      );
    } catch (error) {
      console.error("Konum analizi başlatılamadı:", error);
      setMessage("Konum analizi başlatılırken bir hata oluştu.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setCriteria([createEmptyCriterion(), createEmptyCriterion()]);
    setMessage("");
    setIsRunning(false);
    onResetAnalysis?.();
  };

  const getCategoryStyle = (criterion) => {
    const isDuplicate =
      criterion.categoryKey &&
      duplicateCategoryKeys.has(criterion.categoryKey);

    const isInvalid =
      criterion.touchedCategory &&
      (!criterion.categoryKey || Boolean(isDuplicate));

    return {
      ...panelStyles.select,
      ...(isInvalid ? panelStyles.invalidField : {}),
    };
  };

  const getScoreStyle = (criterion) => {
    const score = Number(criterion.score);
    const isInvalid =
      criterion.touchedScore &&
      (!Number.isFinite(score) || score <= 0 || score > 100);

    return {
      ...panelStyles.scoreInput,
      ...(isInvalid ? panelStyles.invalidField : {}),
    };
  };

  return (
    <div style={panelStyles.panel}>
      <style>
        {`
          @keyframes locationAnalysisSpin {
            to { transform: rotate(360deg); }
          }

          .location-analysis-panel::-webkit-scrollbar {
            width: 6px;
          }

          .location-analysis-panel::-webkit-scrollbar-track {
            background: transparent;
          }

          .location-analysis-panel::-webkit-scrollbar-thumb {
            border-radius: 999px;
            background: rgba(148, 163, 184, 0.20);
          }

          .location-analysis-panel select option,
          .location-analysis-panel select optgroup {
            background: #0a1730;
            color: #e2e8f0;
          }
        `}
      </style>

      <div className="location-analysis-panel" style={panelStyles.scrollArea}>
        <header style={panelStyles.header}>
          <h2 style={panelStyles.title}>Konum Analizi</h2>

          <button
            type="button"
            onClick={onClose}
            style={panelStyles.closeButton}
            aria-label="Konum analizi panelini kapat"
            title="Kapat"
          >
            ×
          </button>
        </header>

        <section style={panelStyles.section}>
          <div style={panelStyles.sectionTopRow}>
            <div style={panelStyles.sectionHeadingCentered}>
              <strong style={panelStyles.sectionTitle}>Hedef alan</strong>
              <span style={panelStyles.sectionSubtitle}>
                Analiz yapılacak polygon alanını belirle.
              </span>
            </div>

            {areaSelected && (
              <span style={panelStyles.selectedBadge}>Seçildi</span>
            )}
          </div>

          <button
            type="button"
            onClick={onDrawArea}
            style={panelStyles.drawButton}
          >
            <span style={panelStyles.buttonIcon}>⌖</span>
            {areaSelected ? "Alanı Yeniden Çiz" : "Haritadan Alan Çiz"}
          </button>
        </section>

        <div style={panelStyles.divider} />

        <section style={panelStyles.section}>
          <div style={panelStyles.sectionTopRow}>
            <div style={panelStyles.sectionHeadingCentered}>
              <strong style={panelStyles.sectionTitle}>Kriterler</strong>
              <span style={panelStyles.sectionSubtitle}>
                En az 2, en fazla 5 farklı kategori.
              </span>
            </div>

            <span style={panelStyles.criteriaCount}>
              {criteria.length}/{MAX_CRITERIA}
            </span>
          </div>

          <div style={panelStyles.columnLabels}>
            <span style={panelStyles.categoryColumnLabel}>Kategori</span>
            <span style={panelStyles.scoreColumnLabel}>Puan</span>
          </div>

          <div style={panelStyles.criteriaRows}>
            {criteria.map((criterion, index) => {
              const isDuplicate =
                criterion.categoryKey &&
                duplicateCategoryKeys.has(criterion.categoryKey);

              const score = Number(criterion.score);
              const scoreInvalid =
                criterion.touchedScore &&
                (!Number.isFinite(score) || score <= 0 || score > 100);

              return (
                <div key={criterion.id}>
                  <div style={panelStyles.criterionRow}>
                    <span style={panelStyles.rowNumber}>{index + 1}</span>

                    <select
                      value={criterion.categoryKey}
                      onChange={(event) =>
                        updateCategory(criterion.id, event.target.value)
                      }
                      style={getCategoryStyle(criterion)}
                      aria-label={`Kriter ${index + 1} kategorisi`}
                    >
                      <option value="">Kategori seç</option>

                      {categories.map((parent) => (
                        <optgroup key={parent.id} label={parent.name}>
                          <option value={`parent:${parent.id}`}>
                            {parent.name} — Ana kategori
                          </option>

                          {(parent.children || []).map((child) => (
                            <option
                              key={child.id}
                              value={`child:${child.id}`}
                            >
                              {child.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    <div style={panelStyles.scoreWrapper}>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={criterion.score}
                        onChange={(event) =>
                          updateScore(criterion.id, event.target.value)
                        }
                        placeholder="0"
                        style={getScoreStyle(criterion)}
                        aria-label={`Kriter ${index + 1} puanı`}
                      />

                      <span style={panelStyles.percentText}>%</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeCriterion(criterion.id)}
                      style={{
                        ...panelStyles.deleteButton,
                        ...(criteria.length <= MIN_CRITERIA
                          ? panelStyles.deleteButtonLimited
                          : {}),
                      }}
                      title={
                        criteria.length <= MIN_CRITERIA
                          ? `En az ${MIN_CRITERIA} kriter kalmalıdır`
                          : "Kriteri sil"
                      }
                      aria-label={`Kriter ${index + 1} sil`}
                    >
                      ×
                    </button>
                  </div>

                  {(criterion.touchedCategory &&
                    !criterion.categoryKey) ||
                  isDuplicate ||
                  scoreInvalid ? (
                    <div style={panelStyles.rowError}>
                      {isDuplicate
                        ? "Bu kategori başka bir kriterde zaten seçildi."
                        : !criterion.categoryKey
                        ? "Kategori seçmelisin."
                        : "Puan 1 ile 100 arasında olmalıdır."}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div style={panelStyles.criteriaFooter}>
            <button
              type="button"
              onClick={addCriterion}
              style={{
                ...panelStyles.addCriterionButton,
                ...(criteria.length >= MAX_CRITERIA
                  ? panelStyles.addCriterionButtonLimit
                  : {}),
              }}
            >
              <span style={panelStyles.plusIcon}>+</span>
              Yeni kriter
            </button>

            <div
              style={{
                ...panelStyles.totalScore,
                ...(scoreState === "valid"
                  ? panelStyles.totalScoreValid
                  : scoreState === "over"
                  ? panelStyles.totalScoreOver
                  : panelStyles.totalScoreUnder),
              }}
            >
              {totalScore}
              <span style={panelStyles.totalScoreSuffix}>/100</span>
            </div>
          </div>

          <div style={panelStyles.progressTrack}>
            <div
              style={{
                ...panelStyles.progressFill,
                width: `${scoreProgress}%`,
                ...(scoreState === "valid"
                  ? panelStyles.progressValid
                  : scoreState === "over"
                  ? panelStyles.progressOver
                  : panelStyles.progressUnder),
              }}
            />
          </div>

          {scoreState !== "under" && (
            <div
              style={{
                ...panelStyles.progressMessage,
                ...(scoreState === "valid"
                  ? panelStyles.progressMessageValid
                  : panelStyles.progressMessageOver),
              }}
            >
              {scoreState === "valid"
                ? "✓ Puan dağılımı tamamlandı."
                : `${totalScore - 100} puan azaltmalısın.`}
            </div>
          )}
        </section>

        {message && <div style={panelStyles.warningBox}>{message}</div>}

        <button
          type="button"
          onClick={handleStart}
          style={{
            ...panelStyles.startButton,
            ...(canStart ? panelStyles.startButtonReady : {}),
            ...(isRunning ? panelStyles.startButtonRunning : {}),
          }}
        >
          {isRunning ? (
            <span style={panelStyles.loadingContent}>
              <span style={panelStyles.spinner} />
              Analiz çalıştırılıyor
            </span>
          ) : (
            <>
              <span style={panelStyles.analysisIcon}>◉</span>
              Analizi Başlat
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleReset}
          style={panelStyles.resetButton}
        >
          Analizi Temizle
        </button>
      </div>
    </div>
  );
}

const panelStyles = {
  panel: {
    position: "absolute",
    top: 74,
    right: 18,
    width: 360,
    maxWidth: "calc(100vw - 36px)",
    maxHeight: "calc(100vh - 98px)",
    zIndex: 3600,
    overflow: "hidden",
    borderRadius: 20,
    background: "rgba(7, 18, 42, 0.97)",
    border: "1px solid rgba(148, 163, 184, 0.16)",
    boxShadow:
      "0 24px 64px rgba(2, 6, 23, 0.46), inset 0 1px 0 rgba(255,255,255,0.035)",
    color: "#ffffff",
  },

  scrollArea: {
    maxHeight: "calc(100vh - 98px)",
    overflowY: "auto",
    padding: "16px 16px 14px",
    boxSizing: "border-box",
  },

  header: {
    position: "relative",
    minHeight: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 42px 14px",
  },

  title: {
    width: "100%",
    margin: 0,
    color: "#f8fafc",
    fontSize: 21,
    lineHeight: 1.2,
    fontWeight: 900,
    letterSpacing: "-0.35px",
    textAlign: "center",
  },

  closeButton: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: "1px solid rgba(148, 163, 184, 0.14)",
    background: "rgba(17, 31, 56, 0.88)",
    color: "#aebbd0",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
  },

  section: {
    padding: "12px 2px 2px",
  },

  sectionTopRow: {
    position: "relative",
    minHeight: 45,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 50px",
  },

  sectionHeadingCentered: {
    width: "100%",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },

  sectionTitle: {
    display: "block",
    width: "100%",
    color: "#f1f5f9",
    fontSize: 13,
    fontWeight: 900,
    textAlign: "center",
  },

  sectionSubtitle: {
    display: "block",
    width: "100%",
    marginTop: 3,
    color: "#71839c",
    fontSize: 10,
    lineHeight: 1.35,
    textAlign: "center",
  },

  selectedBadge: {
    position: "absolute",
    right: 0,
    top: "50%",
    transform: "translateY(-50%)",
    padding: "5px 8px",
    borderRadius: 999,
    color: "#86efac",
    background: "rgba(22, 163, 74, 0.12)",
    border: "1px solid rgba(74, 222, 128, 0.18)",
    fontSize: 9.5,
    fontWeight: 850,
  },

  criteriaCount: {
    position: "absolute",
    right: 0,
    top: "50%",
    transform: "translateY(-50%)",
    minWidth: 38,
    height: 24,
    padding: "0 8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    background: "rgba(17, 31, 56, 0.72)",
    border: "1px solid rgba(96, 165, 250, 0.12)",
    color: "#9fb5d2",
    fontSize: 10,
    fontWeight: 850,
  },

  divider: {
    height: 1,
    margin: "13px 0 2px",
    background:
      "linear-gradient(90deg, transparent, rgba(148,163,184,0.16), transparent)",
  },

  drawButton: {
    width: "100%",
    height: 38,
    marginTop: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    border: "1px solid rgba(96, 165, 250, 0.22)",
    borderRadius: 10,
    background: "#1d5eea",
    boxShadow: "0 8px 18px rgba(29, 94, 234, 0.18)",
    color: "#ffffff",
    fontSize: 11.5,
    fontWeight: 850,
    cursor: "pointer",
  },

  buttonIcon: {
    fontSize: 14,
  },

  columnLabels: {
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr) 62px 24px",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
    marginBottom: 6,
    color: "#5f718a",
    fontSize: 8.5,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.55px",
  },

  categoryColumnLabel: {
    gridColumn: "2",
  },

  scoreColumnLabel: {
    gridColumn: "3",
    textAlign: "center",
  },

  criteriaRows: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  criterionRow: {
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr) 62px 24px",
    alignItems: "center",
    gap: 7,
  },

  rowNumber: {
    color: "#60738d",
    fontSize: 10,
    fontWeight: 900,
    textAlign: "center",
  },

  select: {
    width: "100%",
    height: 36,
    minWidth: 0,
    padding: "0 10px",
    boxSizing: "border-box",
    borderRadius: 9,
    border: "1px solid rgba(96, 165, 250, 0.14)",
    background: "rgba(8, 21, 42, 0.88)",
    color: "#dce8f8",
    fontSize: 10.5,
    outline: "none",
  },

  scoreWrapper: {
    position: "relative",
    width: 62,
  },

  scoreInput: {
    width: "100%",
    height: 36,
    padding: "0 20px 0 8px",
    boxSizing: "border-box",
    borderRadius: 9,
    border: "1px solid rgba(96, 165, 250, 0.14)",
    background: "rgba(8, 21, 42, 0.88)",
    color: "#dce8f8",
    fontSize: 10.5,
    fontWeight: 800,
    outline: "none",
  },

  percentText: {
    position: "absolute",
    top: "50%",
    right: 7,
    transform: "translateY(-50%)",
    color: "#566a85",
    fontSize: 9,
    pointerEvents: "none",
  },

  invalidField: {
    border: "1px solid rgba(248, 113, 113, 0.72)",
    boxShadow: "0 0 0 2px rgba(248, 113, 113, 0.08)",
  },

  deleteButton: {
    width: 24,
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: 7,
    background: "transparent",
    color: "#a86069",
    fontSize: 16,
    lineHeight: 1,
    cursor: "pointer",
  },

  deleteButtonLimited: {
    opacity: 0.35,
  },

  rowError: {
    margin: "4px 0 0 31px",
    color: "#e99a9a",
    fontSize: 9.5,
    lineHeight: 1.3,
  },

  criteriaFooter: {
    minHeight: 30,
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  addCriterionButton: {
    padding: 0,
    border: "none",
    background: "transparent",
    color: "#93c5fd",
    fontSize: 10.5,
    fontWeight: 850,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  },

  addCriterionButtonLimit: {
    color: "#9a6970",
  },

  plusIcon: {
    fontSize: 15,
    lineHeight: 1,
  },

  totalScore: {
    display: "inline-flex",
    alignItems: "baseline",
    justifyContent: "flex-end",
    minWidth: 54,
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.5px",
    textAlign: "right",
  },

  totalScoreSuffix: {
    marginLeft: 2,
    fontSize: 9.5,
    fontWeight: 800,
    color: "#657790",
  },

  totalScoreValid: {
    color: "#4ade80",
  },

  totalScoreOver: {
    color: "#f87171",
  },

  totalScoreUnder: {
    color: "#60a5fa",
  },

  progressTrack: {
    width: "100%",
    height: 6,
    marginTop: 7,
    overflow: "hidden",
    borderRadius: 999,
    background: "#071226",
    border: "1px solid rgba(148, 163, 184, 0.07)",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
    transition: "width 0.22s ease",
  },

  progressValid: {
    background: "#22c55e",
  },

  progressOver: {
    background: "#ef4444",
  },

  progressUnder: {
    background: "#2563eb",
  },

  progressMessage: {
    marginTop: 7,
    fontSize: 9.5,
    fontWeight: 750,
  },

  progressMessageValid: {
    color: "#86efac",
  },

  progressMessageOver: {
    color: "#fca5a5",
  },

  warningBox: {
    marginTop: 10,
    padding: "9px 10px",
    borderRadius: 10,
    background: "rgba(127, 29, 29, 0.14)",
    border: "1px solid rgba(248, 113, 113, 0.18)",
    color: "#fecaca",
    fontSize: 10.5,
    lineHeight: 1.4,
    fontWeight: 700,
  },

  startButton: {
    width: "100%",
    minHeight: 42,
    marginTop: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    border: "1px solid rgba(96, 165, 250, 0.16)",
    borderRadius: 11,
    background: "#173c83",
    color: "#ffffff",
    fontSize: 11.5,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 9px 20px rgba(2, 6, 23, 0.24)",
  },

  startButtonReady: {
    background: "#1d5eea",
    boxShadow: "0 10px 24px rgba(29, 94, 234, 0.25)",
  },

  startButtonRunning: {
    opacity: 0.82,
    cursor: "wait",
  },

  analysisIcon: {
    fontSize: 13,
  },

  loadingContent: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  spinner: {
    width: 12,
    height: 12,
    display: "inline-block",
    borderRadius: "50%",
    border: "2px solid rgba(255, 255, 255, 0.28)",
    borderTopColor: "#ffffff",
    animation: "locationAnalysisSpin 0.8s linear infinite",
  },

  resetButton: {
    width: "100%",
    height: 30,
    marginTop: 5,
    border: "none",
    borderRadius: 9,
    background: "transparent",
    color: "#7789a1",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
  },
};

export default LocationAnalysisPanel;
