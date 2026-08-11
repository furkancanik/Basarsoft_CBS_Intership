import { useEffect, useMemo, useState } from "react";

const parsePoiTimeToMinutes = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const timeText = String(value).trim();
  const match = timeText.match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
};

const isPoiOpenNow = (openingTime, closingTime, currentDate = new Date()) => {
  const openingMinutes = parsePoiTimeToMinutes(openingTime);
  const closingMinutes = parsePoiTimeToMinutes(closingTime);

  if (openingMinutes === null || closingMinutes === null) {
    return false;
  }

  const currentMinutes =
    currentDate.getHours() * 60 + currentDate.getMinutes();

  if (openingMinutes === closingMinutes) {
    return true;
  }

  if (openingMinutes < closingMinutes) {
    return (
      currentMinutes >= openingMinutes &&
      currentMinutes < closingMinutes
    );
  }

  return (
    currentMinutes >= openingMinutes ||
    currentMinutes < closingMinutes
  );
};

const formatPoiTime = (value) => {
  const minutes = parsePoiTimeToMinutes(value);

  if (minutes === null) {
    return "--:--";
  }

  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");

  return `${hour}:${minute}`;
};

function PoiSearchBar({
  poiSourceRef,
  mapObjectRef,
  openPoiInfo,
  showOnlyOpen = false,
  onShowOnlyOpenChange,
  categories = [],
  selectedCategories = [],
  onSelectedCategoriesChange,
  transitStopSourceRef,
  transitRoutes = [],
  hiddenTransitRouteIds = [],
  isTransitRouteVisible,
  onToggleTransitRouteVisibility,
  onShowAllTransitRoutes,
  onHideAllTransitRoutes,
  onZoomToTransitRoute,
  openTransitStopInfo,
}) {
  const [searchText, setSearchText] = useState("");
  const [searchMode, setSearchMode] = useState("poi");
  const [focused, setFocused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [clockTick, setClockTick] = useState(() => Date.now());

  useEffect(() => {
    const clockInterval = window.setInterval(() => {
      setClockTick(Date.now());
    }, 30 * 1000);

    return () => {
      window.clearInterval(clockInterval);
    };
  }, []);

  const normalizeText = (value) =>
    String(value || "")
      .trim()
      .toLocaleLowerCase("tr-TR");

  const parentCategories = useMemo(() => {
    const categoryNames = Array.isArray(categories)
      ? categories
          .map((category) => category?.name ?? category?.Name)
          .filter(Boolean)
      : [];

    if (categoryNames.length > 0) {
      return [...new Set(categoryNames)].sort((a, b) =>
        String(a).localeCompare(String(b), "tr-TR")
      );
    }

    const source = poiSourceRef?.current;

    if (!source) {
      return [];
    }

    return [
      ...new Set(
        source
          .getFeatures()
          .map((feature) => feature.get("parentCategoryName"))
          .filter(Boolean)
      ),
    ].sort((a, b) => String(a).localeCompare(String(b), "tr-TR"));
  }, [categories, poiSourceRef]);

  const selectedCategoryKeys = useMemo(
    () => selectedCategories.map(normalizeText),
    [selectedCategories]
  );

  const routeById = useMemo(() => {
    const routeMap = new Map();

    (Array.isArray(transitRoutes) ? transitRoutes : []).forEach((route) => {
      const routeId = Number(route?.id ?? route?.Id);

      if (Number.isInteger(routeId) && routeId > 0) {
        routeMap.set(routeId, route);
      }
    });

    return routeMap;
  }, [transitRoutes]);

  const filteredTransitRoutes = useMemo(() => {
    const query = normalizeText(searchText);

    const routes =
      Array.isArray(transitRoutes)
        ? transitRoutes
        : [];

    if (searchMode !== "route" || !query) {
      return routes;
    }

    return routes.filter((route) => {
      const routeName = normalizeText(
        route?.name ??
          route?.Name
      );

      const shortCode = normalizeText(
        route?.shortCode ??
          route?.ShortCode
      );

      return (
        routeName.includes(query) ||
        shortCode.includes(query)
      );
    });
  }, [
    transitRoutes,
    searchMode,
    searchText,
  ]);

  const getRouteVisible = (routeId) => {
    if (
      typeof isTransitRouteVisible ===
      "function"
    ) {
      return isTransitRouteVisible(
        routeId
      );
    }

    const normalizedRouteId =
      Number(routeId);

    return !(
      Array.isArray(
        hiddenTransitRouteIds
      ) &&
      hiddenTransitRouteIds.includes(
        normalizedRouteId
      )
    );
  };

  const getTransitStopRouteInfo = (feature) => {
    const routeId = Number(
      feature?.get("transitRouteId") ??
        feature?.get("routeId") ??
        feature?.get("TransitRouteId")
    );

    const route = routeById.get(routeId);

    return {
      routeId,
      routeName:
        feature?.get("routeName") ??
        route?.name ??
        route?.Name ??
        "Güzergah belirtilmedi",
      shortCode:
        feature?.get("routeShortCode") ??
        feature?.get("shortCode") ??
        route?.shortCode ??
        route?.ShortCode ??
        "",
      routeColor:
        feature?.get("routeColor") ??
        route?.color ??
        route?.Color ??
        "#2563eb",
      stopType:
        feature?.get("stopType") ??
        feature?.get("StopType") ??
        "Bus",
    };
  };

  const searchResults = useMemo(() => {
    const query = normalizeText(searchText);

    if (
      searchMode === "route" ||
      !query ||
      query.length < 2
    ) {
      return [];
    }

    if (searchMode === "stop") {
      const source = transitStopSourceRef?.current;

      if (!source) {
        return [];
      }

      return source
        .getFeatures()
        .filter((feature) => {
          const routeInfo = getTransitStopRouteInfo(feature);
          const name = normalizeText(feature.get("name"));
          const routeName = normalizeText(routeInfo.routeName);
          const shortCode = normalizeText(routeInfo.shortCode);
          const stopType = normalizeText(routeInfo.stopType);

          return (
            name.includes(query) ||
            routeName.includes(query) ||
            shortCode.includes(query) ||
            stopType.includes(query) ||
            (stopType === "bus" && "otobüs".includes(query)) ||
            (stopType === "metro" && "metro".includes(query))
          );
        })
        .sort((firstFeature, secondFeature) => {
          const firstRoute = getTransitStopRouteInfo(firstFeature);
          const secondRoute = getTransitStopRouteInfo(secondFeature);

          const firstRouteText = `${firstRoute.shortCode} ${firstRoute.routeName}`;
          const secondRouteText = `${secondRoute.shortCode} ${secondRoute.routeName}`;

          const routeCompare = firstRouteText.localeCompare(
            secondRouteText,
            "tr-TR"
          );

          if (routeCompare !== 0) {
            return routeCompare;
          }

          return (
            Number(firstFeature.get("orderNo") || 0) -
            Number(secondFeature.get("orderNo") || 0)
          );
        })
        .slice(0, 12);
    }

    const source = poiSourceRef?.current;

    if (!source) {
      return [];
    }

    const now = new Date(clockTick);

    return source
      .getFeatures()
      .filter((feature) => {
        if (
          showOnlyOpen &&
          !isPoiOpenNow(
            feature.get("openingTime"),
            feature.get("closingTime"),
            now
          )
        ) {
          return false;
        }

        const parentCategoryKey = normalizeText(
          feature.get("parentCategoryName")
        );

        if (
          selectedCategoryKeys.length > 0 &&
          !selectedCategoryKeys.includes(parentCategoryKey)
        ) {
          return false;
        }

        const name = normalizeText(feature.get("name"));
        const categoryName = normalizeText(feature.get("categoryName"));
        const parentCategoryName = normalizeText(
          feature.get("parentCategoryName")
        );

        return (
          name.includes(query) ||
          categoryName.includes(query) ||
          parentCategoryName.includes(query)
        );
      })
      .slice(0, 8);
  }, [
    searchText,
    searchMode,
    poiSourceRef,
    transitStopSourceRef,
    showOnlyOpen,
    clockTick,
    selectedCategoryKeys,
    routeById,
  ]);

  const selectPoi = (feature) => {
    const map = mapObjectRef?.current;
    const geometry = feature?.getGeometry();

    if (!map || !geometry) {
      return;
    }

    const coordinate = geometry.getCoordinates();

    map.getView().animate({
      center: coordinate,
      zoom: 15,
      duration: 700,
    });

    setSearchText(feature.get("name") || "");
    setFocused(false);

    window.setTimeout(() => {
      if (typeof openPoiInfo === "function") {
        openPoiInfo(feature);
      }
    }, 750);
  };

  const selectTransitStop = (feature) => {
    const map = mapObjectRef?.current;
    const geometry = feature?.getGeometry();

    if (!map || !geometry) {
      return;
    }

    const coordinate = geometry.getCoordinates();
    const routeInfo = getTransitStopRouteInfo(feature);

    map.getView().animate({
      center: coordinate,
      zoom: 16,
      duration: 750,
    });

    setSearchText(feature.get("name") || "");
    setFocused(false);

    window.setTimeout(() => {
      if (typeof openTransitStopInfo === "function") {
        openTransitStopInfo(feature, routeInfo);
      }
    }, 780);
  };

  const clearSearch = () => {
    setSearchText("");
    setFocused(false);
  };

  const changeSearchMode = (nextMode) => {
    setSearchMode(nextMode);
    setSearchText("");
    setFocused(false);
    setCategoryMenuOpen(false);
  };

  const toggleExpanded = () => {
    setExpanded((current) => {
      const nextValue = !current;

      if (!nextValue) {
        setFocused(false);
        setCategoryMenuOpen(false);
      }

      return nextValue;
    });
  };

  const handleOpenFilterChange = () => {
    const nextValue = !showOnlyOpen;

    if (typeof onShowOnlyOpenChange === "function") {
      onShowOnlyOpenChange(nextValue);
    }
  };

  const toggleCategory = (categoryName) => {
    if (typeof onSelectedCategoriesChange !== "function") {
      return;
    }

    const categoryKey = normalizeText(categoryName);
    const alreadySelected = selectedCategories.some(
      (selectedCategory) =>
        normalizeText(selectedCategory) === categoryKey
    );

    if (alreadySelected) {
      onSelectedCategoriesChange(
        selectedCategories.filter(
          (selectedCategory) =>
            normalizeText(selectedCategory) !== categoryKey
        )
      );
      return;
    }

    onSelectedCategoriesChange([
      ...selectedCategories,
      categoryName,
    ]);
  };

  const clearCategoryFilter = () => {
    if (typeof onSelectedCategoriesChange === "function") {
      onSelectedCategoriesChange([]);
    }
  };

  const isCategorySelected = (categoryName) =>
    selectedCategoryKeys.includes(normalizeText(categoryName));

  const showResults =
    expanded &&
    searchMode !== "route" &&
    focused &&
    searchText.trim().length >= 2 &&
    searchResults.length > 0;

  const showEmpty =
    expanded &&
    searchMode !== "route" &&
    focused &&
    searchText.trim().length >= 2 &&
    searchResults.length === 0;

  return (
    <div
      style={{
        ...searchStyles.wrapper,
        width: expanded ? 372 : 44,
      }}
    >
      <div
        style={{
          ...searchStyles.searchCard,
          ...(expanded
            ? searchStyles.searchCardExpanded
            : searchStyles.searchCardCollapsed),
        }}
      >
        <div
          style={{
            ...searchStyles.inputWrapper,
            ...(expanded
              ? searchStyles.inputWrapperExpanded
              : searchStyles.inputWrapperCollapsed),
          }}
        >
          <button
            type="button"
            onClick={toggleExpanded}
            style={searchStyles.iconButton}
            aria-label={expanded ? "Aramayı kapat" : "POI, durak veya hat panelini aç"}
            title={expanded ? "Aramayı kapat" : "POI, durak veya hat ara"}
          >
            ⌕
          </button>

          <div
            style={{
              ...searchStyles.expandableContent,
              ...(expanded
                ? searchStyles.expandableContentVisible
                : searchStyles.expandableContentHidden),
            }}
          >
            <input
              type="text"
              value={searchText}
              placeholder={
                searchMode === "route"
                  ? "Hat adı veya kodu ara..."
                  : searchMode === "stop"
                    ? "Durak veya güzergah ara..."
                    : showOnlyOpen
                      ? "Açık POI ara..."
                      : "POI ara..."
              }
              onFocus={() => setFocused(true)}
              onChange={(event) => {
                setSearchText(event.target.value);
                setFocused(true);
              }}
              style={searchStyles.input}
              tabIndex={expanded ? 0 : -1}
            />

            {searchText && (
              <button
                type="button"
                onClick={clearSearch}
                style={searchStyles.clearButton}
                aria-label="Aramayı temizle"
                tabIndex={expanded ? 0 : -1}
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            ...searchStyles.searchModeTabs,
            ...(expanded
              ? searchStyles.searchModeTabsVisible
              : searchStyles.searchModeTabsHidden),
          }}
        >
          <button
            type="button"
            onClick={() => changeSearchMode("poi")}
            style={{
              ...searchStyles.searchModeButton,
              ...(searchMode === "poi"
                ? searchStyles.searchModeButtonActive
                : {}),
            }}
            tabIndex={expanded ? 0 : -1}
          >
            POI
          </button>

          <button
            type="button"
            onClick={() => changeSearchMode("stop")}
            style={{
              ...searchStyles.searchModeButton,
              ...(searchMode === "stop"
                ? searchStyles.searchModeButtonActive
                : {}),
            }}
            tabIndex={expanded ? 0 : -1}
          >
            Durak
          </button>

          <button
            type="button"
            onClick={() => changeSearchMode("route")}
            style={{
              ...searchStyles.searchModeButton,
              ...(searchMode === "route"
                ? searchStyles.searchModeButtonActive
                : {}),
            }}
            tabIndex={expanded ? 0 : -1}
          >
            Hat
          </button>
        </div>

        <div
          style={{
            ...searchStyles.panelContent,
            ...(expanded
              ? searchStyles.panelContentVisible
              : searchStyles.panelContentHidden),
          }}
        >
          {searchMode === "poi" && (
            <>
          <button
            type="button"
            onClick={handleOpenFilterChange}
            style={searchStyles.filterRow}
            aria-pressed={showOnlyOpen}
          >
            <span style={searchStyles.filterTextGroup}>
              <span
                style={{
                  ...searchStyles.statusDot,
                  ...(showOnlyOpen
                    ? searchStyles.statusDotActive
                    : searchStyles.statusDotPassive),
                }}
              />

              <strong style={searchStyles.filterTitle}>
                Açık POI&apos;ler
              </strong>
            </span>

            <span
              style={{
                ...searchStyles.switchTrack,
                ...(showOnlyOpen ? searchStyles.switchTrackActive : {}),
              }}
            >
              <span
                style={{
                  ...searchStyles.switchThumb,
                  ...(showOnlyOpen ? searchStyles.switchThumbActive : {}),
                }}
              />
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryMenuOpen((current) => !current)}
            style={{
              ...searchStyles.categoryToggle,
              ...(categoryMenuOpen
                ? searchStyles.categoryToggleActive
                : {}),
            }}
            aria-expanded={categoryMenuOpen}
          >
            <span style={searchStyles.categoryToggleLeft}>
              <span style={searchStyles.categoryFolderIcon}>▦</span>
              <strong style={searchStyles.categoryToggleTitle}>
                Kategoriler
              </strong>

              {selectedCategories.length > 0 && (
                <span style={searchStyles.selectedCountBadge}>
                  {selectedCategories.length}
                </span>
              )}
            </span>

            <span
              style={{
                ...searchStyles.categoryChevron,
                ...(categoryMenuOpen
                  ? searchStyles.categoryChevronOpen
                  : {}),
              }}
            >
              ▾
            </span>
          </button>

          {categoryMenuOpen && (
            <div style={searchStyles.categoryPanel}>
              <div style={searchStyles.categoryPanelHeader}>
                <span style={searchStyles.categoryPanelTitle}>
                  Haritada gösterilecek kategoriler
                </span>

                {selectedCategories.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCategoryFilter}
                    style={searchStyles.clearCategoriesButton}
                  >
                    Tümünü göster
                  </button>
                )}
              </div>

              <div style={searchStyles.categoryList}>
                {parentCategories.length > 0 ? (
                  parentCategories.map((categoryName) => {
                    const checked = isCategorySelected(categoryName);

                    return (
                      <label
                        key={categoryName}
                        style={{
                          ...searchStyles.categoryItem,
                          ...(checked
                            ? searchStyles.categoryItemSelected
                            : {}),
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCategory(categoryName)}
                          style={searchStyles.categoryCheckbox}
                        />

                        <span
                          style={{
                            ...searchStyles.categoryColorDot,
                            ...(checked
                              ? searchStyles.categoryColorDotSelected
                              : {}),
                          }}
                        />

                        <span style={searchStyles.categoryName}>
                          {categoryName}
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <div style={searchStyles.noCategoryText}>
                    Kategori bulunamadı.
                  </div>
                )}
              </div>
            </div>
          )}
            </>
          )}

          {searchMode === "route" && (
            <div style={searchStyles.routeLayerPanel}>
              <div style={searchStyles.routeLayerHeader}>
                <div style={searchStyles.routeLayerTitleGroup}>
                  <span style={searchStyles.routeLayerTitleIcon}>
                    ⇄
                  </span>

                  <div>
                    <div style={searchStyles.routeLayerTitle}>
                      Hat Katmanları
                    </div>
                    <div style={searchStyles.routeLayerSubtitle}>
                      Hatları aç, kapat veya yakınlaştır
                    </div>
                  </div>
                </div>

                <span style={searchStyles.routeLayerCount}>
                  {filteredTransitRoutes.length}
                </span>
              </div>

              <div style={searchStyles.routeLayerBulkActions}>
                <button
                  type="button"
                  onClick={() =>
                    onShowAllTransitRoutes?.()
                  }
                  style={searchStyles.routeLayerOpenAll}
                >
                  Tümünü Aç
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onHideAllTransitRoutes?.()
                  }
                  style={searchStyles.routeLayerCloseAll}
                >
                  Tümünü Kapat
                </button>
              </div>

              <div style={searchStyles.routeLayerList}>
                {filteredTransitRoutes.length === 0 ? (
                  <div style={searchStyles.routeLayerEmpty}>
                    Kayıtlı veya eşleşen hat bulunamadı.
                  </div>
                ) : (
                  filteredTransitRoutes.map((route) => {
                    const routeId =
                      route?.id ??
                      route?.Id;

                    const routeName =
                      route?.name ??
                      route?.Name ??
                      "İsimsiz Güzergah";

                    const shortCode =
                      route?.shortCode ??
                      route?.ShortCode ??
                      "";

                    const routeColor =
                      route?.color ??
                      route?.Color ??
                      "#2563eb";

                    const routeVisible =
                      getRouteVisible(
                        routeId
                      );

                    return (
                      <div
                        key={routeId}
                        style={{
                          ...searchStyles.routeLayerItem,
                          ...(routeVisible
                            ? searchStyles.routeLayerItemVisible
                            : searchStyles.routeLayerItemHidden),
                        }}
                      >
                        <label
                          style={searchStyles.routeLayerMain}
                          title={
                            routeVisible
                              ? "Hattı gizle"
                              : "Hattı göster"
                          }
                        >
                          <input
                            type="checkbox"
                            checked={routeVisible}
                            onChange={() =>
                              onToggleTransitRouteVisibility?.(
                                routeId
                              )
                            }
                            style={{
                              ...searchStyles.routeLayerCheckbox,
                              accentColor:
                                routeColor,
                            }}
                          />

                          <span
                            style={{
                              ...searchStyles.routeLayerColor,
                              background:
                                routeColor,
                            }}
                          />

                          <span style={searchStyles.routeLayerText}>
                            <strong style={searchStyles.routeLayerCode}>
                              {shortCode || "HAT"}
                            </strong>

                            <span style={searchStyles.routeLayerName}>
                              {routeName}
                            </span>
                          </span>
                        </label>

                        <button
                          type="button"
                          onClick={() =>
                            onZoomToTransitRoute?.(
                              routeId
                            )
                          }
                          style={searchStyles.routeLayerZoom}
                          title={`${routeName} hattına yakınlaştır`}
                          aria-label={`${routeName} hattına yakınlaştır`}
                        >
                          ⊙
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showResults && (
        <div style={searchStyles.results}>
          {searchResults.map((feature, index) => {
            if (searchMode === "stop") {
              const id = feature.get("id");
              const name = feature.get("name") || "İsimsiz Durak";
              const orderNo = Number(feature.get("orderNo") || 0);
              const routeInfo = getTransitStopRouteInfo(feature);
              const isMetro =
                normalizeText(routeInfo.stopType) === "metro";

              return (
                <button
                  type="button"
                  key={`${id ?? "stop"}-${index}`}
                  onClick={() => selectTransitStop(feature)}
                  style={searchStyles.resultItem}
                >
                  <span
                    style={{
                      ...searchStyles.stopMarker,
                      background: routeInfo.routeColor,
                    }}
                  >
                    {isMetro ? "M" : "O"}
                  </span>

                  <span style={searchStyles.resultText}>
                    <span style={searchStyles.resultTitleRow}>
                      <strong style={searchStyles.resultName}>
                        {name}
                      </strong>

                      {orderNo > 0 && (
                        <span style={searchStyles.stopOrderBadge}>
                          {orderNo}. durak
                        </span>
                      )}
                    </span>

                    <span style={searchStyles.stopRouteLine}>
                      <span
                        style={{
                          ...searchStyles.routeColorDot,
                          background: routeInfo.routeColor,
                        }}
                      />

                      <strong style={searchStyles.stopShortCode}>
                        {routeInfo.shortCode || "Hat"}
                      </strong>

                      <span style={searchStyles.stopRouteName}>
                        {routeInfo.routeName}
                      </span>
                    </span>

                    <span style={searchStyles.resultHours}>
                      {isMetro ? "Metro durağı" : "Otobüs durağı"} 
                   
                    </span>
                  </span>
                </button>
              );
            }

            const id = feature.get("id");
            const name = feature.get("name") || "İsimsiz POI";
            const categoryName =
              feature.get("categoryName") || "Kategori belirtilmedi";
            const parentCategoryName =
              feature.get("parentCategoryName") || "";
            const openingTime = feature.get("openingTime");
            const closingTime = feature.get("closingTime");
            const openNow = isPoiOpenNow(
              openingTime,
              closingTime,
              new Date(clockTick)
            );

            return (
              <button
                type="button"
                key={`${id ?? "poi"}-${index}`}
                onClick={() => selectPoi(feature)}
                style={searchStyles.resultItem}
              >
                <span style={searchStyles.marker}>📍</span>

                <span style={searchStyles.resultText}>
                  <span style={searchStyles.resultTitleRow}>
                    <strong style={searchStyles.resultName}>{name}</strong>

                    <span
                      style={{
                        ...searchStyles.openBadge,
                        ...(openNow
                          ? searchStyles.openBadgeActive
                          : searchStyles.openBadgeClosed),
                      }}
                    >
                      {openNow ? "Açık" : "Kapalı"}
                    </span>
                  </span>

                  <span style={searchStyles.resultCategory}>
                    {parentCategoryName
                      ? `${parentCategoryName} · ${categoryName}`
                      : categoryName}
                  </span>

                  <span style={searchStyles.resultHours}>
                    {formatPoiTime(openingTime)} –{" "}
                    {formatPoiTime(closingTime)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {showEmpty && (
        <div style={searchStyles.emptyResult}>
          {searchMode === "stop"
            ? "Bu aramayla eşleşen durak veya güzergah bulunamadı."
            : showOnlyOpen || selectedCategories.length > 0
              ? "Aktif filtrelerle eşleşen POI bulunamadı."
              : "Bu aramayla eşleşen POI bulunamadı."}
        </div>
      )}
    </div>
  );
}

const searchStyles = {
  wrapper: {
    position: "absolute",
    top: 68,
    left: 18,
    maxWidth: "calc(100vw - 36px)",
    zIndex: 3500,
    transition:
      "width 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
  },

  searchCard: {
    overflow: "hidden",
    background: "rgba(7,18,42,0.97)",
    border: "1px solid rgba(96,165,250,0.28)",
    boxShadow: "0 14px 34px rgba(2,6,23,0.38)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    transition:
      "all 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
    transformOrigin: "left center",
  },

  searchCardExpanded: {
    width: "100%",
    borderRadius: 14,
    opacity: 1,
    transform: "translateX(0) scaleX(1)",
  },

  searchCardCollapsed: {
    width: 44,
    height: 44,
    borderRadius: 13,
    opacity: 1,
    transform: "translateX(0) scaleX(1)",
    boxShadow: "0 10px 26px rgba(2,6,23,0.34)",
  },

  inputWrapper: {
    display: "flex",
    alignItems: "center",
    transition: "all 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
  },

  inputWrapperExpanded: {
    height: 46,
    gap: 9,
    padding: "0 10px",
  },

  inputWrapperCollapsed: {
    width: 44,
    height: 44,
    padding: 0,
    justifyContent: "center",
  },

  iconButton: {
    width: 40,
    height: 40,
    flexShrink: 0,
    border: "none",
    borderRadius: 11,
    background: "transparent",
    color: "#93c5fd",
    fontSize: 22,
    fontWeight: 900,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.2s ease, transform 0.2s ease",
  },

  expandableContent: {
    minWidth: 0,
    flex: 1,
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
    transition:
      "opacity 0.18s ease, transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), max-width 0.28s ease",
  },

  expandableContentVisible: {
    maxWidth: 285,
    opacity: 1,
    transform: "translateX(0)",
  },

  expandableContentHidden: {
    maxWidth: 0,
    opacity: 0,
    transform: "translateX(-16px)",
    pointerEvents: "none",
  },

  input: {
    flex: 1,
    minWidth: 0,
    height: 42,
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 700,
  },

  clearButton: {
    width: 26,
    height: 26,
    flexShrink: 0,
    border: "none",
    borderRadius: "50%",
    background: "rgba(148,163,184,0.16)",
    color: "#e2e8f0",
    fontSize: 19,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  searchModeTabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 4,
    overflow: "hidden",
    background: "rgba(5,15,34,0.96)",
    borderTop: "1px solid rgba(148,163,184,0.10)",
    transition: "max-height 0.24s ease, opacity 0.18s ease",
  },

  searchModeTabsVisible: {
    maxHeight: 48,
    opacity: 1,
    padding: "6px 8px",
  },

  searchModeTabsHidden: {
    maxHeight: 0,
    opacity: 0,
    padding: "0 8px",
    pointerEvents: "none",
  },

  searchModeButton: {
    height: 31,
    border: "1px solid transparent",
    borderRadius: 9,
    background: "transparent",
    color: "#8093ad",
    fontSize: 11,
    fontWeight: 850,
    cursor: "pointer",
  },

  searchModeButtonActive: {
    color: "#ffffff",
    background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
    borderColor: "rgba(147,197,253,0.28)",
    boxShadow: "0 6px 16px rgba(37,99,235,0.22)",
  },

  routeLayerPanel: {
    borderTop:
      "1px solid rgba(148,163,184,0.10)",
    background:
      "rgba(5,15,34,0.78)",
    padding: "9px",
  },

  routeLayerHeader: {
    minHeight: 38,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "2px 2px 8px",
  },

  routeLayerTitleGroup: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  routeLayerTitleIcon: {
    width: 26,
    height: 26,
    flexShrink: 0,
    borderRadius: 8,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#93c5fd",
    background:
      "rgba(37,99,235,0.18)",
    fontSize: 13,
    fontWeight: 900,
  },

  routeLayerTitle: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: 900,
    lineHeight: 1.1,
  },

  routeLayerSubtitle: {
    marginTop: 2,
    color: "#7891ad",
    fontSize: 9,
    fontWeight: 700,
  },

  routeLayerCount: {
    minWidth: 24,
    height: 22,
    padding: "0 7px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "rgba(37,99,235,0.18)",
    border:
      "1px solid rgba(96,165,250,0.20)",
    color: "#bfdbfe",
    fontSize: 10,
    fontWeight: 900,
  },

  routeLayerBulkActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 6,
    marginBottom: 7,
  },

  routeLayerOpenAll: {
    height: 29,
    borderRadius: 8,
    border:
      "1px solid rgba(96,165,250,0.24)",
    background:
      "rgba(37,99,235,0.18)",
    color: "#bfdbfe",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 850,
  },

  routeLayerCloseAll: {
    height: 29,
    borderRadius: 8,
    border:
      "1px solid rgba(148,163,184,0.18)",
    background:
      "rgba(30,41,59,0.68)",
    color: "#cbd5e1",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 850,
  },

  routeLayerList: {
    maxHeight: 250,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },

  routeLayerItem: {
    minHeight: 42,
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 1fr) 29px",
    alignItems: "center",
    gap: 6,
    padding: "4px 5px 4px 8px",
    borderRadius: 9,
    border:
      "1px solid rgba(148,163,184,0.10)",
    transition:
      "opacity .16s ease, background .16s ease",
  },

  routeLayerItemVisible: {
    opacity: 1,
    background:
      "rgba(15,36,67,0.68)",
  },

  routeLayerItemHidden: {
    opacity: 0.54,
    background:
      "rgba(15,23,42,0.46)",
  },

  routeLayerMain: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns:
      "14px 10px minmax(0,1fr)",
    alignItems: "center",
    gap: 7,
    cursor: "pointer",
  },

  routeLayerCheckbox: {
    width: 14,
    height: 14,
    margin: 0,
    cursor: "pointer",
  },

  routeLayerColor: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    border:
      "1.5px solid rgba(255,255,255,0.82)",
    boxShadow:
      "0 1px 4px rgba(0,0,0,0.28)",
  },

  routeLayerText: {
    minWidth: 0,
    display: "flex",
    alignItems: "baseline",
    gap: 5,
  },

  routeLayerCode: {
    flexShrink: 0,
    color: "#f8fafc",
    fontSize: 10,
    fontWeight: 900,
  },

  routeLayerName: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#b9cbe0",
    fontSize: 9.5,
    fontWeight: 750,
  },

  routeLayerZoom: {
    width: 29,
    height: 29,
    padding: 0,
    borderRadius: 8,
    border:
      "1px solid rgba(96,165,250,0.20)",
    background:
      "rgba(37,99,235,0.14)",
    color: "#bfdbfe",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 900,
  },

  routeLayerEmpty: {
    padding: "14px 8px",
    color: "#8498af",
    textAlign: "center",
    fontSize: 10,
    fontWeight: 700,
  },

  panelContent: {
    overflow: "hidden",
    transition:
      "max-height 0.3s ease, opacity 0.2s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
  },

  panelContentVisible: {
    maxHeight: 420,
    opacity: 1,
    transform: "translateX(0)",
  },

  panelContentHidden: {
    maxHeight: 0,
    opacity: 0,
    transform: "translateX(-24px)",
    pointerEvents: "none",
  },

  filterRow: {
    width: "100%",
    minHeight: 38,
    padding: "7px 11px",
    border: "none",
    borderTop: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,31,58,0.72)",
    color: "#ffffff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    textAlign: "left",
  },

  filterTextGroup: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 7,
  },

  statusDot: {
    width: 7,
    height: 7,
    flexShrink: 0,
    borderRadius: "50%",
  },

  statusDotActive: {
    background: "#22c55e",
    boxShadow: "0 0 0 3px rgba(34,197,94,0.12)",
  },

  statusDotPassive: {
    background: "#64748b",
    boxShadow: "0 0 0 3px rgba(100,116,139,0.10)",
  },

  filterTitle: {
    display: "block",
    color: "#dce8f8",
    fontSize: 10.5,
    fontWeight: 800,
    lineHeight: 1.2,
  },

  switchTrack: {
    position: "relative",
    width: 32,
    height: 18,
    flexShrink: 0,
    borderRadius: 999,
    background: "#26364d",
    border: "1px solid rgba(148,163,184,0.16)",
    transition: "all 0.2s ease",
  },

  switchTrackActive: {
    background: "#16a34a",
    borderColor: "rgba(74,222,128,0.38)",
  },

  switchThumb: {
    position: "absolute",
    top: 2,
    left: 2,
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "#ffffff",
    boxShadow: "0 2px 6px rgba(2,6,23,0.32)",
    transition: "transform 0.2s ease",
  },

  switchThumbActive: {
    transform: "translateX(14px)",
  },

  categoryToggle: {
    width: "100%",
    minHeight: 38,
    padding: "7px 11px",
    border: "none",
    borderTop: "1px solid rgba(148,163,184,0.10)",
    background: "rgba(10,24,48,0.84)",
    color: "#dce8f8",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    textAlign: "left",
  },

  categoryToggleActive: {
    background: "rgba(22,45,82,0.92)",
  },

  categoryToggleLeft: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 7,
  },

  categoryFolderIcon: {
    color: "#93c5fd",
    fontSize: 12,
    lineHeight: 1,
  },

  categoryToggleTitle: {
    color: "#dce8f8",
    fontSize: 10.5,
    fontWeight: 800,
  },

  selectedCountBadge: {
    minWidth: 17,
    height: 17,
    padding: "0 5px",
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    background: "#2563eb",
    color: "#ffffff",
    fontSize: 8.5,
    fontWeight: 900,
  },

  categoryChevron: {
    color: "#7186a2",
    fontSize: 12,
    transition: "transform 0.18s ease",
  },

  categoryChevronOpen: {
    transform: "rotate(180deg)",
  },

  categoryPanel: {
    padding: "8px 9px 9px",
    borderTop: "1px solid rgba(148,163,184,0.10)",
    background: "rgba(7,18,42,0.99)",
  },

  categoryPanelHeader: {
    minHeight: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },

  categoryPanelTitle: {
    color: "#7186a2",
    fontSize: 9,
    fontWeight: 800,
  },

  clearCategoriesButton: {
    padding: 0,
    border: "none",
    background: "transparent",
    color: "#93c5fd",
    fontSize: 9,
    fontWeight: 850,
    cursor: "pointer",
  },

  categoryList: {
    maxHeight: 230,
    overflowY: "auto",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 5,
  },

  categoryItem: {
    minWidth: 0,
    minHeight: 30,
    padding: "5px 7px",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    background: "rgba(15,31,58,0.68)",
    border: "1px solid rgba(148,163,184,0.09)",
    color: "#b8c6d9",
    cursor: "pointer",
  },

  categoryItemSelected: {
    background: "rgba(37,99,235,0.16)",
    border: "1px solid rgba(96,165,250,0.28)",
    color: "#e6f0ff",
  },

  categoryCheckbox: {
    width: 13,
    height: 13,
    margin: 0,
    flexShrink: 0,
    accentColor: "#2563eb",
    cursor: "pointer",
  },

  categoryColorDot: {
    width: 7,
    height: 7,
    flexShrink: 0,
    borderRadius: "50%",
    background: "#53657c",
  },

  categoryColorDotSelected: {
    background: "#60a5fa",
    boxShadow: "0 0 0 3px rgba(96,165,250,0.12)",
  },

  categoryName: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 9.5,
    fontWeight: 750,
  },

  noCategoryText: {
    gridColumn: "1 / -1",
    padding: "8px",
    color: "#7186a2",
    fontSize: 10,
    textAlign: "center",
  },

  results: {
    marginTop: 7,
    padding: 7,
    maxHeight: 350,
    overflowY: "auto",
    borderRadius: 13,
    background: "rgba(7,18,42,0.98)",
    border: "1px solid rgba(96,165,250,0.22)",
    boxShadow: "0 18px 42px rgba(2,6,23,0.44)",
  },

  resultItem: {
    width: "100%",
    minHeight: 66,
    padding: "9px 10px",
    border: "none",
    borderRadius: 10,
    background: "transparent",
    color: "#ffffff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 10,
    textAlign: "left",
  },

  marker: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 10,
    background: "rgba(37,99,235,0.18)",
    border: "1px solid rgba(96,165,250,0.24)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  resultText: {
    minWidth: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },

  resultTitleRow: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  resultName: {
    minWidth: 0,
    color: "#ffffff",
    fontSize: 13.5,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  openBadge: {
    flexShrink: 0,
    padding: "3px 6px",
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 900,
  },

  openBadgeActive: {
    color: "#86efac",
    background: "rgba(22,163,74,0.14)",
    border: "1px solid rgba(74,222,128,0.18)",
  },

  openBadgeClosed: {
    color: "#fca5a5",
    background: "rgba(185,28,28,0.13)",
    border: "1px solid rgba(248,113,113,0.16)",
  },

  resultCategory: {
    color: "#94a3b8",
    fontSize: 11.5,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  resultHours: {
    color: "#6f829e",
    fontSize: 10.5,
    fontWeight: 700,
  },

  stopMarker: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: "50%",
    border: "3px solid #ffffff",
    color: "#ffffff",
    boxShadow: "0 0 0 2px rgba(96,165,250,0.24)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 950,
  },

  stopOrderBadge: {
    flexShrink: 0,
    padding: "3px 6px",
    borderRadius: 999,
    color: "#bfdbfe",
    background: "rgba(37,99,235,0.16)",
    border: "1px solid rgba(96,165,250,0.20)",
    fontSize: 8.5,
    fontWeight: 900,
  },

  stopRouteLine: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 5,
    color: "#a9bad0",
    fontSize: 10.5,
  },

  routeColorDot: {
    width: 7,
    height: 7,
    flexShrink: 0,
    borderRadius: "50%",
  },

  stopShortCode: {
    flexShrink: 0,
    color: "#ffffff",
    fontSize: 10.5,
  },

  stopRouteName: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  emptyResult: {
    marginTop: 7,
    padding: "14px 16px",
    borderRadius: 13,
    background: "rgba(7,18,42,0.98)",
    border: "1px solid rgba(96,165,250,0.22)",
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 700,
    boxShadow: "0 18px 42px rgba(2,6,23,0.44)",
  },
}
;

export default PoiSearchBar;
