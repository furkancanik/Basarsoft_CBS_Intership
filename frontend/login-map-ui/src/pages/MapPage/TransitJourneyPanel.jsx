import { useMemo, useState } from "react";
import axios from "axios";

import {
  API_BASE_URL,
  getAuthConfig,
} from "./api";

const formatDistance = (meters) => {
  const value = Number(meters);

  if (!Number.isFinite(value)) {
    return "-";
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} km`;
  }

  return `${Math.round(value)} m`;
};

const formatDuration = (seconds) => {
  const value = Math.max(
    0,
    Number(seconds || 0)
  );

  if (!Number.isFinite(value)) {
    return "-";
  }

  const roundedMinutes =
    Math.round(value / 60);

  if (roundedMinutes < 60) {
    return `${roundedMinutes} dk`;
  }

  const hours = Math.floor(
    roundedMinutes / 60
  );

  const minutes =
    roundedMinutes % 60;

  return minutes > 0
    ? `${hours} sa ${minutes} dk`
    : `${hours} sa`;
};

const formatTime = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(date);
};

const formatJourneyDateTime = (
  value,
  referenceValue = new Date()
) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  const reference = new Date(referenceValue);

  if (
    Number.isNaN(date.getTime()) ||
    Number.isNaN(reference.getTime())
  ) {
    return String(value);
  }

  const dateOnly = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const referenceOnly = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate()
  );

  const dayDifference = Math.round(
    (dateOnly.getTime() -
      referenceOnly.getTime()) /
      86_400_000
  );

  const timeText = formatTime(value);

  if (dayDifference === 0) {
    return `Bugün ${timeText}`;
  }

  if (dayDifference === 1) {
    return `Yarın ${timeText}`;
  }

  if (dayDifference === -1) {
    return `Dün ${timeText}`;
  }

  const dateText =
    new Intl.DateTimeFormat(
      "tr-TR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    ).format(date);

  return `${dateText} ${timeText}`;
};

const getWaitingNotice = (seconds) => {
  const value = Number(seconds || 0);

  if (!Number.isFinite(value)) {
    return null;
  }

  if (value >= 6 * 60 * 60) {
    return {
      level: "veryLong",
      title: "Çok uzun bekleme",
      text:
        "Uygun sefer sonraki gün veya çok daha ileri bir saatte. " +
        "Daha erken bir sefer eklendiğinde toplam yolculuk süresi ciddi şekilde kısalır.",
    };
  }

  if (value >= 2 * 60 * 60) {
    return {
      level: "long",
      title: "Uzun bekleme",
      text:
        "Uygun sefer için bekleme süresi yüksek. " +
        "Alternatif bir sefer saati veya hat varsa daha iyi sonuç alınabilir.",
    };
  }

  return null;
};

const getStepIcon = (type) => {
  const normalized =
    String(type || "")
      .trim()
      .toLowerCase();

  if (normalized === "walk") {
    return "🚶";
  }

  if (normalized === "transit") {
    return "🚌";
  }

  if (normalized === "getoff") {
    return "⬇";
  }

  return "•";
};


const normalizeVehicleType = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "walk" ||
    normalized === "walking" ||
    normalized === "yürüme" ||
    normalized === "yaya"
  ) {
    return "walk";
  }

  if (
    normalized === "metro" ||
    normalized === "subway" ||
    normalized === "rail"
  ) {
    return "metro";
  }

  return "bus";
};

const MODE_OPTIONS = [
  {
    key: "walk",
    label: "Yürüme",
    icon: "🚶",
  },
  {
    key: "bus",
    label: "Otobüs",
    icon: "🚌",
  },
  {
    key: "metro",
    label: "Metro",
    icon: "🚇",
  },
];

const normalizePoint = (point) => {
  if (!point) {
    return null;
  }

  const longitude = Number(
    point.longitude ??
      point.lon ??
      point[0]
  );

  const latitude = Number(
    point.latitude ??
      point.lat ??
      point[1]
  );

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude)
  ) {
    return null;
  }

  return {
    longitude,
    latitude,
    poiId:
      point.poiId ??
      point.PoiId ??
      null,
    poiName:
      point.poiName ??
      point.PoiName ??
      "",
  };
};

const normalizePoiSearchText = (value) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR");


function TransitJourneyPanel({
  startPoint,
  endPoint,

  selectionMode = "",

  poiOptions = [],
  onSelectStartPoi,
  onSelectEndPoi,

  onSelectStartPoint,
  onSelectEndPoint,
  onClearStartPoint,
  onClearEndPoint,

  onAlternativesChanged,
  onAlternativeSelected,
  onClearJourney,

  onClose,
}) {
  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [infoMessage, setInfoMessage] =
    useState("");

  const [alternatives, setAlternatives] =
    useState([]);

  const [
    selectedAlternativeIndex,
    setSelectedAlternativeIndex,
  ] = useState(0);

  const [activeMode, setActiveMode] =
    useState("bus");

  const [activePoiPicker, setActivePoiPicker] =
    useState("");

  const [startPoiSearch, setStartPoiSearch] =
    useState("");

  const [endPoiSearch, setEndPoiSearch] =
    useState("");

  const normalizedStartPoint =
    useMemo(
      () => normalizePoint(startPoint),
      [startPoint]
    );

  const normalizedEndPoint =
    useMemo(
      () => normalizePoint(endPoint),
      [endPoint]
    );

  const normalizedPoiOptions =
    useMemo(() => {
      return (
        Array.isArray(poiOptions)
          ? poiOptions
          : []
      )
        .map((poi) => {
          const longitude =
            Number(
              poi?.longitude ??
                poi?.lon
            );

          const latitude =
            Number(
              poi?.latitude ??
                poi?.lat
            );

          if (
            !Number.isFinite(longitude) ||
            !Number.isFinite(latitude)
          ) {
            return null;
          }

          return {
            id:
              poi?.id ??
              poi?.Id ??
              null,
            name:
              poi?.name ??
              poi?.Name ??
              "İsimsiz POI",
            categoryName:
              poi?.categoryName ??
              poi?.CategoryName ??
              "",
            parentCategoryName:
              poi?.parentCategoryName ??
              poi?.ParentCategoryName ??
              "",
            longitude,
            latitude,
          };
        })
        .filter(Boolean);
    }, [poiOptions]);

  const filterPois = (query) => {
    const normalizedQuery =
      normalizePoiSearchText(query);

    const source =
      normalizedPoiOptions;

    if (!normalizedQuery) {
      return source.slice(0, 8);
    }

    return source
      .filter((poi) => {
        return (
          normalizePoiSearchText(
            poi.name
          ).includes(
            normalizedQuery
          ) ||
          normalizePoiSearchText(
            poi.categoryName
          ).includes(
            normalizedQuery
          ) ||
          normalizePoiSearchText(
            poi.parentCategoryName
          ).includes(
            normalizedQuery
          )
        );
      })
      .slice(0, 8);
  };

  const startPoiResults =
    useMemo(
      () =>
        filterPois(
          startPoiSearch
        ),
      [
        startPoiSearch,
        normalizedPoiOptions,
      ]
    );

  const endPoiResults =
    useMemo(
      () =>
        filterPois(
          endPoiSearch
        ),
      [
        endPoiSearch,
        normalizedPoiOptions,
      ]
    );

  const canPlan =
    normalizedStartPoint &&
    normalizedEndPoint &&
    !loading;


  const modeCounts = useMemo(() => {
    const walkCount = alternatives.filter(
      (alternative) =>
        normalizeVehicleType(
          alternative.vehicleType
        ) === "walk"
    ).length;

    const busCount = alternatives.filter(
      (alternative) =>
        normalizeVehicleType(
          alternative.vehicleType
        ) === "bus"
    ).length;

    const metroCount = alternatives.filter(
      (alternative) =>
        normalizeVehicleType(
          alternative.vehicleType
        ) === "metro"
    ).length;

    return {
      walk: walkCount,
      bus: busCount,
      metro: metroCount,
    };
  }, [alternatives]);

  const visibleAlternativeEntries =
    useMemo(() => {
      return alternatives
        .map((alternative, originalIndex) => ({
          alternative,
          originalIndex,
        }))
        .filter(({ alternative }) =>
          normalizeVehicleType(
            alternative.vehicleType
          ) === activeMode
        )
        .sort((left, right) => {
          if (activeMode === "walk") {
            return (
              Number(
                left.alternative
                  .totalDurationSeconds || 0
              ) -
              Number(
                right.alternative
                  .totalDurationSeconds || 0
              )
            );
          }

          return (
            Number(left.alternative.score || 0) -
            Number(right.alternative.score || 0)
          );
        });
    }, [alternatives, activeMode]);

  const clearResults = () => {
    setAlternatives([]);
    setSelectedAlternativeIndex(0);
    setActiveMode("bus");
    setErrorMessage("");
    setInfoMessage("");

    onAlternativesChanged?.([]);
    onAlternativeSelected?.(null);
  };

  const handleClearAll = () => {
    clearResults();

    setActivePoiPicker("");
    setStartPoiSearch("");
    setEndPoiSearch("");

    onClearStartPoint?.();
    onClearEndPoint?.();
    onClearJourney?.();
  };

  const handlePoiSelect = (
    mode,
    poi
  ) => {
    if (!poi) {
      return;
    }

    clearResults();

    if (mode === "start") {
      setStartPoiSearch(
        poi.name || ""
      );

      onSelectStartPoi?.(poi);
    } else {
      setEndPoiSearch(
        poi.name || ""
      );

      onSelectEndPoi?.(poi);
    }

    setActivePoiPicker("");
  };


  const handlePlanJourney = async () => {
    if (!normalizedStartPoint) {
      setErrorMessage(
        "Önce başlangıç noktasını seçmelisin."
      );
      return;
    }

    if (!normalizedEndPoint) {
      setErrorMessage(
        "Önce bitiş noktasını seçmelisin."
      );
      return;
    }

    if (
      normalizedStartPoint.poiId &&
      normalizedEndPoint.poiId &&
      String(
        normalizedStartPoint.poiId
      ) ===
        String(
          normalizedEndPoint.poiId
        )
    ) {
      setErrorMessage(
        "Başlangıç ve hedef için aynı POI seçilemez."
      );
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setInfoMessage("");

      const response = await axios.post(
        `${API_BASE_URL}/api/transit-journey/plan`,
        {
          startLongitude:
            normalizedStartPoint.longitude,

          startLatitude:
            normalizedStartPoint.latitude,

          endLongitude:
            normalizedEndPoint.longitude,

          endLatitude:
            normalizedEndPoint.latitude,

          /*
           * Hocanın istediği kapsam:
           * Yürü -> Bin -> İn -> Yürü.
           *
           * Başlangıç ve bitişte 5 km'ye kadar
           * yürüme adayı incelenebilir.
           * Backend en uygun adayları puanlar.
           */
          maximumWalkingDistanceMeters: 5000,
          candidateStopCount: 10,
          alternativeCount: 3,
        },
        getAuthConfig()
      );

      const responseAlternatives =
        Array.isArray(
          response.data?.alternatives
        )
          ? response.data.alternatives
          : [];

      setAlternatives(
        responseAlternatives
      );

      const firstBusIndex =
        responseAlternatives.findIndex(
          (alternative) =>
            normalizeVehicleType(
              alternative.vehicleType
            ) === "bus"
        );

      const firstMetroIndex =
        responseAlternatives.findIndex(
          (alternative) =>
            normalizeVehicleType(
              alternative.vehicleType
            ) === "metro"
        );

      const initialIndex =
        firstBusIndex >= 0
          ? firstBusIndex
          : firstMetroIndex >= 0
            ? firstMetroIndex
            : 0;

      const initialMode =
        firstBusIndex >= 0
          ? "bus"
          : firstMetroIndex >= 0
            ? "metro"
            : "walk";

      setActiveMode(initialMode);
      setSelectedAlternativeIndex(
        initialIndex
      );

      setInfoMessage(
        response.data?.message ||
          (responseAlternatives.length > 0
            ? `${responseAlternatives.length} alternatif bulundu.`
            : "Uygun toplu taşıma seçeneği bulunamadı.")
      );

      onAlternativesChanged?.(
        responseAlternatives
      );

      if (
        responseAlternatives.length > 0
      ) {
        onAlternativeSelected?.(
          responseAlternatives[
            initialIndex
          ],
          initialIndex
        );
      } else {
        onAlternativeSelected?.(null);
      }
    } catch (error) {
      console.error(
        "Toplu taşıma yol tarifi alınamadı:",
        error
      );

      const backendMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message;

      setErrorMessage(
        backendMessage ||
          "Toplu taşıma yol tarifi hesaplanırken hata oluştu."
      );

      setAlternatives([]);
      onAlternativesChanged?.([]);
      onAlternativeSelected?.(null);
    } finally {
      setLoading(false);
    }
  };

  const selectAlternative = (
    alternative,
    index
  ) => {
    setSelectedAlternativeIndex(index);

    onAlternativeSelected?.(
      alternative,
      index
    );
  };

  const selectMode = (mode) => {
    if (modeCounts[mode] === 0) {
      return;
    }

    setActiveMode(mode);

    const firstMatchingEntry =
      alternatives
        .map((alternative, originalIndex) => ({
          alternative,
          originalIndex,
        }))
        .find(({ alternative }) =>
          normalizeVehicleType(
            alternative.vehicleType
          ) === mode
        );

    if (firstMatchingEntry) {
      setSelectedAlternativeIndex(
        firstMatchingEntry.originalIndex
      );

      onAlternativeSelected?.(
        firstMatchingEntry.alternative,
        firstMatchingEntry.originalIndex
      );
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>
              TOPLU TAŞIMA
            </div>

            <h2 style={styles.title}>
              Yol Tarifi
            </h2>

            <div style={styles.subtitle}>
              Yürü → Bin → İn → Yürü
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={styles.closeButton}
            title="Kapat"
          >
            ×
          </button>
        </div>

        <div style={styles.body}>
          <div style={styles.pointSection}>
            <div style={styles.pointRow}>
              <div
                style={{
                  ...styles.pointLetter,
                  background: "#16a34a",
                }}
              >
                A
              </div>

              <div style={styles.pointContent}>
                <div style={styles.pointLabel}>
                  Başlangıç
                </div>

                <div style={styles.pointValue}>
                  {normalizedStartPoint
                    ? normalizedStartPoint.poiName ||
                      `${normalizedStartPoint.latitude.toFixed(
                        5
                      )}, ${normalizedStartPoint.longitude.toFixed(
                        5
                      )}`
                    : "Haritadan veya POI'den başlangıç seç"}
                </div>
              </div>

              <button
                type="button"
                onClick={onSelectStartPoint}
                style={{
                  ...styles.selectPointButton,
                  ...(selectionMode ===
                  "start"
                    ? styles.activeSelectButton
                    : {}),
                }}
              >
                {selectionMode === "start"
                  ? "Haritaya tıkla"
                  : "Seç"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePoiPicker(
                    activePoiPicker === "start"
                      ? ""
                      : "start"
                  );
                }}
                style={{
                  ...styles.poiSelectButton,
                  ...(activePoiPicker ===
                  "start"
                    ? styles.poiSelectButtonActive
                    : {}),
                }}
                title="Başlangıç POI seç"
              >
                POI
              </button>

              {normalizedStartPoint && (
                <button
                  type="button"
                  onClick={() => {
                    onClearStartPoint?.();
                    clearResults();
                  }}
                  style={
                    styles.clearPointButton
                  }
                >
                  ×
                </button>
              )}
            </div>

            {activePoiPicker === "start" && (
              <div style={styles.poiPicker}>
                <div style={styles.poiPickerTitle}>
                  Başlangıç POI&apos;sini seç
                </div>

                <input
                  type="text"
                  value={startPoiSearch}
                  onChange={(event) =>
                    setStartPoiSearch(
                      event.target.value
                    )
                  }
                  placeholder="Örn. Vadistanbul, hastane, okul..."
                  style={styles.poiSearchInput}
                  autoFocus
                />

                <div style={styles.poiResultList}>
                  {startPoiResults.length > 0 ? (
                    startPoiResults.map(
                      (poi, index) => (
                        <button
                          key={`start-poi-${
                            poi.id ?? index
                          }`}
                          type="button"
                          onClick={() =>
                            handlePoiSelect(
                              "start",
                              poi
                            )
                          }
                          style={
                            styles.poiResultButton
                          }
                        >
                          <span
                            style={
                              styles.poiResultIcon
                            }
                          >
                            📍
                          </span>

                          <span
                            style={
                              styles.poiResultText
                            }
                          >
                            <strong
                              style={
                                styles.poiResultName
                              }
                            >
                              {poi.name}
                            </strong>

                            <span
                              style={
                                styles.poiResultMeta
                              }
                            >
                              {[
                                poi.parentCategoryName,
                                poi.categoryName,
                              ]
                                .filter(Boolean)
                                .join(" • ") ||
                                "POI"}
                            </span>
                          </span>
                        </button>
                      )
                    )
                  ) : (
                    <div
                      style={
                        styles.poiEmptyText
                      }
                    >
                      Eşleşen POI bulunamadı.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={styles.connector}>
              <div style={styles.connectorLine} />
            </div>

            <div style={styles.pointRow}>
              <div
                style={{
                  ...styles.pointLetter,
                  background: "#dc2626",
                }}
              >
                B
              </div>

              <div style={styles.pointContent}>
                <div style={styles.pointLabel}>
                  Bitiş
                </div>

                <div style={styles.pointValue}>
                  {normalizedEndPoint
                    ? normalizedEndPoint.poiName ||
                      `${normalizedEndPoint.latitude.toFixed(
                        5
                      )}, ${normalizedEndPoint.longitude.toFixed(
                        5
                      )}`
                    : "Haritadan veya POI'den hedef seç"}
                </div>
              </div>

              <button
                type="button"
                onClick={onSelectEndPoint}
                style={{
                  ...styles.selectPointButton,
                  ...(selectionMode === "end"
                    ? styles.activeSelectButton
                    : {}),
                }}
              >
                {selectionMode === "end"
                  ? "Haritaya tıkla"
                  : "Seç"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePoiPicker(
                    activePoiPicker === "end"
                      ? ""
                      : "end"
                  );
                }}
                style={{
                  ...styles.poiSelectButton,
                  ...(activePoiPicker === "end"
                    ? styles.poiSelectButtonActive
                    : {}),
                }}
                title="Hedef POI seç"
              >
                POI
              </button>

              {normalizedEndPoint && (
                <button
                  type="button"
                  onClick={() => {
                    onClearEndPoint?.();
                    clearResults();
                  }}
                  style={
                    styles.clearPointButton
                  }
                >
                  ×
                </button>
              )}
            </div>

            {activePoiPicker === "end" && (
              <div style={styles.poiPicker}>
                <div style={styles.poiPickerTitle}>
                  Hedef POI&apos;sini seç
                </div>

                <input
                  type="text"
                  value={endPoiSearch}
                  onChange={(event) =>
                    setEndPoiSearch(
                      event.target.value
                    )
                  }
                  placeholder="Örn. Vadistanbul, hastane, okul..."
                  style={styles.poiSearchInput}
                  autoFocus
                />

                <div style={styles.poiResultList}>
                  {endPoiResults.length > 0 ? (
                    endPoiResults.map(
                      (poi, index) => (
                        <button
                          key={`end-poi-${
                            poi.id ?? index
                          }`}
                          type="button"
                          onClick={() =>
                            handlePoiSelect(
                              "end",
                              poi
                            )
                          }
                          style={
                            styles.poiResultButton
                          }
                        >
                          <span
                            style={
                              styles.poiResultIcon
                            }
                          >
                            📍
                          </span>

                          <span
                            style={
                              styles.poiResultText
                            }
                          >
                            <strong
                              style={
                                styles.poiResultName
                              }
                            >
                              {poi.name}
                            </strong>

                            <span
                              style={
                                styles.poiResultMeta
                              }
                            >
                              {[
                                poi.parentCategoryName,
                                poi.categoryName,
                              ]
                                .filter(Boolean)
                                .join(" • ") ||
                                "POI"}
                            </span>
                          </span>
                        </button>
                      )
                    )
                  ) : (
                    <div
                      style={
                        styles.poiEmptyText
                      }
                    >
                      Eşleşen POI bulunamadı.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={styles.autoTimeInfo}>
            Sefer saati otomatik seçilir. Sistem, A noktasından durağa
            yürüyüş süresini de dikkate alarak ulaşabileceğin ilk aktif
            seferi bulur.
          </div>

          <div style={styles.actionRow}>
            <button
              type="button"
              onClick={handleClearAll}
              style={styles.secondaryButton}
            >
              Temizle
            </button>

            <button
              type="button"
              onClick={handlePlanJourney}
              disabled={!canPlan}
              style={{
                ...styles.primaryButton,
                ...(!canPlan
                  ? styles.disabledButton
                  : {}),
              }}
            >
              {loading
                ? "Hesaplanıyor..."
                : "Toplu Taşıma Rotası Bul"}
            </button>
          </div>

          {errorMessage && (
            <div style={styles.errorBox}>
              {errorMessage}
            </div>
          )}

          {infoMessage && !errorMessage && (
            <div style={styles.infoBox}>
              {infoMessage}
            </div>
          )}

          {alternatives.length > 0 && (
            <div style={styles.modeSelectorSection}>
              <div style={styles.modeSelectorLabel}>
                Ulaşım türü
              </div>

              <div style={styles.modeSelector}>
                {MODE_OPTIONS.map((mode) => {
                  const active =
                    activeMode === mode.key;

                  const disabled =
                    modeCounts[mode.key] === 0;

                  return (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() =>
                        selectMode(mode.key)
                      }
                      disabled={disabled}
                      style={{
                        ...styles.modeButton,
                        ...(active
                          ? styles.modeButtonActive
                          : {}),
                        ...(disabled
                          ? styles.modeButtonDisabled
                          : {}),
                      }}
                    >
                      <span
                        style={styles.modeIcon}
                      >
                        {mode.icon}
                      </span>

                      <span
                        style={styles.modeText}
                      >
                        {mode.label}
                      </span>

                      <span
                        style={styles.modeCount}
                      >
                        {modeCounts[mode.key]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {alternatives.length > 0 && (
            <div
              style={
                styles.alternativesSection
              }
            >
              <div
                style={
                  styles.sectionHeader
                }
              >
                <span>
                  Rota Alternatifleri
                </span>

                <span
                  style={
                    styles.sectionCount
                  }
                >
                  {alternatives.length}
                </span>
              </div>

              <div
                style={
                  styles.alternativeList
                }
              >
                {visibleAlternativeEntries.length ===
                  0 && (
                  <div
                    style={
                      styles.emptyModeResult
                    }
                  >
                    Bu ulaşım türünde uygun seçenek bulunamadı.
                  </div>
                )}

                {visibleAlternativeEntries.map(
                  ({
                    alternative,
                    originalIndex,
                  }) => {
                    const index =
                      originalIndex;

                    const selected =
                      index ===
                      selectedAlternativeIndex;

                    const routeColor =
                      alternative.routeColor ||
                      "#2563eb";

                    const waitingNotice =
                      getWaitingNotice(
                        alternative.waitingDurationSeconds
                      );

                    return (
                      <button
                        type="button"
                        key={`${alternative.tripId}-${alternative.boardingStopId}-${alternative.alightingStopId}-${index}`}
                        onClick={() =>
                          selectAlternative(
                            alternative,
                            index
                          )
                        }
                        style={{
                          ...styles.alternativeCard,
                          ...(selected
                            ? {
                                borderColor:
                                  routeColor,
                                boxShadow: `0 0 0 1px ${routeColor}55`,
                              }
                            : {}),
                        }}
                      >
                        <div
                          style={
                            styles.alternativeTop
                          }
                        >
                          <div
                            style={{
                              ...styles.routeBadge,
                              background:
                                routeColor,
                            }}
                          >
                            {alternative.routeShortCode ||
                              "Hat"}
                          </div>

                          <div
                            style={
                              styles.alternativeTitleBlock
                            }
                          >
                            <div
                              style={
                                styles.alternativeTitle
                              }
                            >
                              {alternative.routeName ||
                                "Toplu Taşıma"}
                            </div>

                            <div
                              style={
                                styles.tripCode
                              }
                            >
                              Sefer{" "}
                              {alternative.tripCode ||
                                "-"}
                            </div>

                            <div
                              style={
                                styles.vehicleTypeText
                              }
                            >
                              {normalizeVehicleType(
                                alternative.vehicleType
                              ) === "walk"
                                ? "🚶 Yürüme"
                                : normalizeVehicleType(
                                    alternative.vehicleType
                                  ) === "metro"
                                  ? "🚇 Metro"
                                  : "🚌 Otobüs"}
                            </div>
                          </div>

                          <div
                            style={
                              styles.totalTime
                            }
                          >
                            {formatDuration(
                              alternative.totalDurationSeconds
                            )}
                          </div>
                        </div>

                        {activeMode === "walk" && (
                          <div
                            style={
                              styles.walkingFocusBox
                            }
                          >
                            <div
                              style={
                                styles.walkingFocusIcon
                              }
                            >
                              🚶
                            </div>

                            <div>
                              <div
                                style={
                                  styles.walkingFocusTitle
                                }
                              >
                                Yürüme bağlantısı
                              </div>

                              <div
                                style={
                                  styles.walkingFocusText
                                }
                              >
                                {normalizeVehicleType(
                                  alternative.vehicleType
                                ) === "walk"
                                  ? `A → B: ${formatDistance(
                                      alternative.totalWalkingMeters
                                    )}`
                                  : `A → ${
                                      alternative.boardingStopName ||
                                      "biniş durağı"
                                    }: ${formatDistance(
                                      alternative.initialWalkingMeters
                                    )}  •  ${
                                      alternative.alightingStopName ||
                                      "iniş durağı"
                                    } → B: ${formatDistance(
                                      alternative.finalWalkingMeters
                                    )}`}
                              </div>
                            </div>
                          </div>
                        )}

                        <div
                          style={
                            styles.metricsGrid
                          }
                        >
                          <div
                            style={
                              styles.metric
                            }
                          >
                            <span
                              style={
                                styles.metricLabel
                              }
                            >
                              Yürüme
                            </span>

                            <strong
                              style={
                                styles.metricValue
                              }
                            >
                              {formatDistance(
                                alternative.totalWalkingMeters
                              )}
                            </strong>
                          </div>

                          <div
                            style={
                              styles.metric
                            }
                          >
                            <span
                              style={
                                styles.metricLabel
                              }
                            >
                              Bekleme
                            </span>

                            <strong
                              style={
                                styles.metricValue
                              }
                            >
                              {formatDuration(
                                alternative.waitingDurationSeconds
                              )}
                            </strong>
                          </div>

                          <div
                            style={
                              styles.metric
                            }
                          >
                            <span
                              style={
                                styles.metricLabel
                              }
                            >
                              Araçta
                            </span>

                            <strong
                              style={
                                styles.metricValue
                              }
                            >
                              {formatDuration(
                                alternative.inVehicleDurationSeconds
                              )}
                            </strong>
                          </div>
                        </div>

                        {normalizeVehicleType(
                          alternative.vehicleType
                        ) !== "walk" && (
                          <>
                            <div
                              style={
                                styles.stopSummary
                              }
                            >
                              <span>
                                <strong>Bin:</strong>{" "}
                                {alternative.boardingStopName}
                              </span>

                              <span>
                                <strong>İn:</strong>{" "}
                                {alternative.alightingStopName}
                              </span>
                            </div>

                            <div
                              style={
                                styles.timeSummary
                              }
                            >
                              <span>
                                Biniş{" "}
                                {formatJourneyDateTime(
                                  alternative.boardingDateTime,
                                  alternative.requestedDepartureDateTime
                                )}
                              </span>

                              <span>
                                İniş{" "}
                                {formatJourneyDateTime(
                                  alternative.alightingDateTime,
                                  alternative.requestedDepartureDateTime
                                )}
                              </span>
                            </div>
                          </>
                        )}

                        {waitingNotice && (
                          <div
                            style={{
                              ...styles.waitingNotice,
                              ...(waitingNotice.level ===
                              "veryLong"
                                ? styles.waitingNoticeVeryLong
                                : styles.waitingNoticeLong),
                            }}
                          >
                            <div
                              style={
                                styles.waitingNoticeTitle
                              }
                            >
                              {waitingNotice.title}
                            </div>

                            <div
                              style={
                                styles.waitingNoticeText
                              }
                            >
                              {waitingNotice.text}
                            </div>
                          </div>
                        )}

                        {selected &&
                          Array.isArray(
                            alternative.steps
                          ) &&
                          alternative.steps
                            .length > 0 && (
                            <div
                              style={
                                styles.steps
                              }
                            >
                              {alternative.steps.map(
                                (
                                  step,
                                  stepIndex
                                ) => (
                                  <div
                                    key={`${step.type}-${stepIndex}`}
                                    style={
                                      styles.stepRow
                                    }
                                  >
                                    <div
                                      style={
                                        styles.stepIcon
                                      }
                                    >
                                      {getStepIcon(
                                        step.type
                                      )}
                                    </div>

                                    <div
                                      style={
                                        styles.stepBody
                                      }
                                    >
                                      <div
                                        style={
                                          styles.stepDescription
                                        }
                                      >
                                        {step.description}
                                      </div>

                                      {(Number(
                                        step.distanceMeters
                                      ) > 0 ||
                                        Number(
                                          step.durationSeconds
                                        ) > 0) && (
                                        <div
                                          style={
                                            styles.stepMeta
                                          }
                                        >
                                          {Number(
                                            step.distanceMeters
                                          ) >
                                            0 && (
                                            <span>
                                              {formatDistance(
                                                step.distanceMeters
                                              )}
                                            </span>
                                          )}

                                          {Number(
                                            step.durationSeconds
                                          ) >
                                            0 && (
                                            <span>
                                              {formatDuration(
                                                step.durationSeconds
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "absolute",
    top: 88,
    left: 18,
    zIndex: 1450,
    pointerEvents: "none",
  },

  panel: {
    width: 410,
    maxWidth: "calc(100vw - 36px)",
    maxHeight: "calc(100vh - 112px)",
    overflowY: "auto",
    pointerEvents: "auto",
    background:
      "linear-gradient(160deg, rgba(4,20,40,0.995), rgba(7,34,64,0.99))",
    border:
      "1px solid rgba(96,165,250,0.26)",
    borderRadius: 16,
    boxShadow:
      "0 24px 70px rgba(2,10,24,0.50)",
    color: "#f8fafc",
  },

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: "18px 18px 15px",
    borderBottom:
      "1px solid rgba(148,197,255,0.12)",
  },

  eyebrow: {
    color: "#60a5fa",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
  },

  title: {
    margin: "3px 0 0",
    fontSize: 22,
    lineHeight: 1.15,
  },

  subtitle: {
    marginTop: 6,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border:
      "1px solid rgba(148,197,255,0.20)",
    background:
      "rgba(15,39,69,0.78)",
    color: "#ffffff",
    fontSize: 24,
    lineHeight: 1,
    cursor: "pointer",
  },

  body: {
    padding: 16,
  },

  pointSection: {
    padding: 13,
    borderRadius: 14,
    background:
      "rgba(15,39,69,0.66)",
    border:
      "1px solid rgba(148,197,255,0.12)",
  },

  pointRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  pointLetter: {
    width: 29,
    height: 29,
    flex: "0 0 29px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 12,
  },

  pointContent: {
    minWidth: 0,
    flex: 1,
  },

  pointLabel: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 800,
    marginBottom: 3,
  },

  pointValue: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  selectPointButton: {
    minHeight: 32,
    border:
      "1px solid rgba(96,165,250,0.28)",
    borderRadius: 9,
    padding: "0 10px",
    background:
      "rgba(30,64,175,0.60)",
    color: "#dbeafe",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },

  activeSelectButton: {
    background:
      "rgba(14,165,233,0.82)",
    color: "#ffffff",
  },

  clearPointButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border:
      "1px solid rgba(248,113,113,0.26)",
    background:
      "rgba(127,29,29,0.36)",
    color: "#fecaca",
    fontWeight: 900,
    cursor: "pointer",
  },

  connector: {
    height: 18,
    paddingLeft: 14,
  },

  connectorLine: {
    width: 1,
    height: "100%",
    background:
      "rgba(148,163,184,0.55)",
  },

  autoTimeInfo: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 10,
    background:
      "rgba(3,105,161,0.18)",
    border:
      "1px solid rgba(56,189,248,0.18)",
    color: "#bae6fd",
    fontSize: 10.5,
    lineHeight: 1.45,
    fontWeight: 700,
  },

  actionRow: {
    display: "grid",
    gridTemplateColumns:
      "110px minmax(0, 1fr)",
    gap: 9,
    marginTop: 12,
  },

  primaryButton: {
    minHeight: 42,
    border: 0,
    borderRadius: 10,
    padding: "0 13px",
    background:
      "linear-gradient(135deg,#2563eb,#0284c7)",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  poiSelectButton: {
    minWidth: 44,
    height: 34,
    padding: "0 8px",
    borderRadius: 8,
    border:
      "1px solid rgba(45,212,191,0.24)",
    background:
      "rgba(13,148,136,0.14)",
    color: "#99f6e4",
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
  },

  poiSelectButtonActive: {
    background:
      "rgba(13,148,136,0.34)",
    border:
      "1px solid rgba(94,234,212,0.55)",
    color: "#ffffff",
  },

  poiPicker: {
    margin: "8px 0 10px 44px",
    padding: 10,
    borderRadius: 11,
    border:
      "1px solid rgba(45,212,191,0.20)",
    background:
      "rgba(4,32,50,0.92)",
  },

  poiPickerTitle: {
    marginBottom: 7,
    color: "#ccfbf1",
    fontSize: 10,
    fontWeight: 900,
  },

  poiSearchInput: {
    width: "100%",
    height: 36,
    boxSizing: "border-box",
    padding: "0 10px",
    borderRadius: 8,
    border:
      "1px solid rgba(94,234,212,0.24)",
    outline: "none",
    background:
      "rgba(8,27,47,0.96)",
    color: "#ffffff",
    fontSize: 11,
  },

  poiResultList: {
    marginTop: 7,
    maxHeight: 210,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },

  poiResultButton: {
    width: "100%",
    minHeight: 46,
    padding: "7px 8px",
    borderRadius: 8,
    border:
      "1px solid rgba(148,197,255,0.10)",
    background:
      "rgba(15,39,69,0.72)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 8,
    textAlign: "left",
    cursor: "pointer",
  },

  poiResultIcon: {
    width: 26,
    height: 26,
    flex: "0 0 26px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "rgba(13,148,136,0.18)",
    fontSize: 13,
  },

  poiResultText: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },

  poiResultName: {
    color: "#f8fafc",
    fontSize: 11,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  poiResultMeta: {
    color: "#8fb0cf",
    fontSize: 9,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  poiEmptyText: {
    padding: "10px 8px",
    color: "#8da5bc",
    fontSize: 10,
    textAlign: "center",
  },

  secondaryButton: {
    minHeight: 42,
    borderRadius: 10,
    border:
      "1px solid rgba(148,197,255,0.18)",
    background:
      "rgba(15,39,69,0.72)",
    color: "#dbeafe",
    fontWeight: 800,
    cursor: "pointer",
  },

  disabledButton: {
    opacity: 0.45,
    cursor: "not-allowed",
  },

  errorBox: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 10,
    background:
      "rgba(127,29,29,0.42)",
    border:
      "1px solid rgba(248,113,113,0.30)",
    color: "#fecaca",
    fontSize: 12,
    fontWeight: 700,
  },

  infoBox: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 10,
    background:
      "rgba(3,105,161,0.20)",
    border:
      "1px solid rgba(56,189,248,0.22)",
    color: "#bae6fd",
    fontSize: 12,
    fontWeight: 700,
  },

  modeSelectorSection: {
    marginTop: 14,
  },

  modeSelectorLabel: {
    marginBottom: 7,
    color: "#9fb4ca",
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: ".08em",
  },

  modeSelector: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
    gap: 7,
  },

  modeButton: {
    minHeight: 58,
    padding: "7px 5px",
    borderRadius: 11,
    border:
      "1px solid rgba(102,141,180,.18)",
    background: "#0b2948",
    color: "#c9d8e7",
    cursor: "pointer",
    display: "grid",
    gridTemplateColumns: "24px 1fr auto",
    alignItems: "center",
    gap: 5,
    textAlign: "left",
  },

  modeButtonActive: {
    border:
      "1px solid rgba(73,145,212,.55)",
    background: "#123c64",
    color: "#ffffff",
    boxShadow:
      "0 0 0 1px rgba(54,126,190,.15)",
  },

  modeButtonDisabled: {
    opacity: 0.36,
    cursor: "not-allowed",
  },

  modeIcon: {
    fontSize: 19,
    lineHeight: 1,
  },

  modeText: {
    fontSize: 10.5,
    fontWeight: 900,
  },

  modeCount: {
    minWidth: 20,
    height: 20,
    padding: "0 5px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "rgba(125,166,204,.16)",
    color: "#bad0e4",
    fontSize: 9,
    fontWeight: 900,
  },

  vehicleTypeText: {
    marginTop: 3,
    color: "#8fb0cf",
    fontSize: 9.5,
    fontWeight: 800,
  },

  walkingFocusBox: {
    marginTop: 10,
    padding: "9px 10px",
    borderRadius: 9,
    border:
      "1px solid rgba(80,139,177,.18)",
    background:
      "rgba(8,49,73,.52)",
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
  },

  walkingFocusIcon: {
    width: 25,
    height: 25,
    flex: "0 0 25px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#123a57",
    fontSize: 13,
  },

  walkingFocusTitle: {
    color: "#d8e8f5",
    fontSize: 10,
    fontWeight: 900,
  },

  walkingFocusText: {
    marginTop: 2,
    color: "#9fb8cc",
    fontSize: 9.5,
    lineHeight: 1.4,
    fontWeight: 700,
  },

  emptyModeResult: {
    padding: "18px 12px",
    borderRadius: 10,
    border:
      "1px dashed rgba(119,151,181,.18)",
    color: "#8da5bc",
    textAlign: "center",
    fontSize: 11,
    fontWeight: 700,
  },

  alternativesSection: {
    marginTop: 14,
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 9,
  },

  sectionCount: {
    minWidth: 24,
    height: 24,
    padding: "0 7px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    background:
      "rgba(37,99,235,0.30)",
    color: "#bfdbfe",
  },

  alternativeList: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
  },

  alternativeCard: {
    width: "100%",
    textAlign: "left",
    padding: 12,
    borderRadius: 13,
    border:
      "1px solid rgba(148,197,255,0.12)",
    background:
      "rgba(8,28,52,0.78)",
    color: "#ffffff",
    cursor: "pointer",
  },

  alternativeTop: {
    display: "flex",
    alignItems: "center",
    gap: 9,
  },

  routeBadge: {
    minWidth: 44,
    height: 30,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    padding: "0 9px",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 900,
  },

  alternativeTitleBlock: {
    minWidth: 0,
    flex: 1,
  },

  alternativeTitle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 900,
  },

  tripCode: {
    marginTop: 2,
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: 700,
  },

  totalTime: {
    color: "#7dd3fc",
    fontSize: 13,
    fontWeight: 900,
  },

  metricsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0,1fr))",
    gap: 7,
    marginTop: 10,
  },

  metric: {
    padding: "8px 7px",
    borderRadius: 9,
    background:
      "rgba(15,39,69,0.70)",
    border:
      "1px solid rgba(148,197,255,0.08)",
  },

  metricLabel: {
    display: "block",
    color: "#8fb3d9",
    fontSize: 9,
    fontWeight: 800,
    marginBottom: 4,
  },

  metricValue: {
    display: "block",
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: 900,
  },

  stopSummary: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginTop: 10,
    color: "#cbd5e1",
    fontSize: 11,
    lineHeight: 1.35,
  },

  timeSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 8,
    color: "#7dd3fc",
    fontSize: 10,
    fontWeight: 800,
  },

  waitingNotice: {
    marginTop: 10,
    padding: "9px 10px",
    borderRadius: 9,
    border: "1px solid",
  },

  waitingNoticeLong: {
    background:
      "rgba(146,64,14,0.20)",
    borderColor:
      "rgba(251,191,36,0.28)",
    color: "#fde68a",
  },

  waitingNoticeVeryLong: {
    background:
      "rgba(127,29,29,0.24)",
    borderColor:
      "rgba(248,113,113,0.32)",
    color: "#fecaca",
  },

  waitingNoticeTitle: {
    fontSize: 10,
    fontWeight: 900,
    marginBottom: 3,
  },

  waitingNoticeText: {
    fontSize: 9.5,
    lineHeight: 1.4,
    fontWeight: 700,
    opacity: 0.95,
  },

  steps: {
    marginTop: 11,
    paddingTop: 10,
    borderTop:
      "1px solid rgba(148,197,255,0.10)",
  },

  stepRow: {
    display: "flex",
    gap: 9,
    padding: "7px 0",
  },

  stepIcon: {
    width: 26,
    height: 26,
    flex: "0 0 26px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background:
      "rgba(30,64,175,0.38)",
    fontSize: 13,
  },

  stepBody: {
    minWidth: 0,
    flex: 1,
  },

  stepDescription: {
    color: "#e2e8f0",
    fontSize: 11,
    lineHeight: 1.4,
    fontWeight: 700,
  },

  stepMeta: {
    display: "flex",
    gap: 9,
    marginTop: 3,
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: 700,
  },
};

export default TransitJourneyPanel;
