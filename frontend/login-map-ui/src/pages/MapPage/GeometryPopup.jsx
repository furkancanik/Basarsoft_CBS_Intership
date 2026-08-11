function GeometryPopup({
  styles,
  popupOpen,
  pendingData,
  form,
  setForm,
  saveSuccess,
  isSaving,
  isEditing,
  setIsEditing,
  inventoryCount,
  analysisResult,
  closePopup,
  saveGeometry,
  updateSelectedGeometry,
  deleteSelectedGeometry,
  deleteInventoryArea,
  getGeometryName,
  getInfoTitle,
  startGeometryEdit,
  isGeometryEditingOnMap,
}) {
  if (!popupOpen) return null;

  const isInventoryAnalysis = pendingData?.type === "Inventory";

  const isGeometryInfo =
    pendingData?.type === "PointInfo" ||
    pendingData?.type === "LineStringInfo" ||
    pendingData?.type === "PolygonInfo";

  const getNewGeometryTitle = () => {
    if (pendingData?.type === "Point") return "Yeni Point";
    if (pendingData?.type === "LineString") return "Yeni Line";
    if (pendingData?.type === "Polygon") return "Yeni Polygon";
    return "Yeni Geometri";
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.popup}>
        <div style={styles.popupTitle}>
          {isGeometryInfo
            ? getInfoTitle()
            : isInventoryAnalysis
            ? "Envanter Analizi"
            : saveSuccess
            ? "Kayıt Başarılı"
            : getNewGeometryTitle()}
        </div>

        <div style={styles.divider}></div>

        {!saveSuccess && !isInventoryAnalysis && !isGeometryInfo && (
          <>
            <div style={styles.label}>İsim</div>
            <input
              style={styles.input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Örn: Alan 1"
            />

            <div style={styles.formRow}>
              <div style={styles.colorColumn}>
                <div style={styles.label}>Renk</div>
                <input
                  style={styles.colorInput}
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                />
              </div>

              <div style={styles.noteColumn}>
                <div style={styles.label}>Not</div>
                <textarea
                  style={styles.textarea}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Açıklama gir..."
                />
              </div>
            </div>

            <div style={styles.popupButtons}>
              <button
                onClick={closePopup}
                style={{ ...styles.button, ...styles.cancelButton }}
                disabled={isSaving}
              >
                İptal
              </button>

              <button
                onClick={saveGeometry}
                disabled={isSaving}
                style={{
                  ...styles.button,
                  ...styles.saveButton,
                  ...(isSaving ? styles.disabledButton : {}),
                }}
              >
                {isSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </>
        )}

        {saveSuccess && isInventoryAnalysis && (
          <>
            <div style={styles.analysisRow}>
              <span>Point Sayısı:</span>
              <span style={styles.analysisValue}>
                {analysisResult?.pointCount ?? 0}
              </span>
            </div>

            <div style={styles.analysisRow}>
              <span>Line Sayısı:</span>
              <span style={styles.analysisValue}>
                {analysisResult?.lineCount ?? 0}
              </span>
            </div>

            <div style={styles.analysisRow}>
              <span>Polygon Sayısı:</span>
              <span style={styles.analysisValue}>
                {analysisResult?.polygonCount ?? 0}
              </span>
            </div>

            <div style={styles.analysisTotal}>
              <span>Toplam Envanter Sayısı:</span>
              <span>{analysisResult?.total ?? 0}</span>
            </div>

            <div style={styles.popupButtons}>
              <button
                onClick={deleteInventoryArea}
                style={styles.deleteButton}
              >
                Sil
              </button>

              <button onClick={closePopup} style={styles.closeButton}>
                Tamam
              </button>
            </div>
          </>
        )}

        {saveSuccess && isGeometryInfo && (
          <>
            {isEditing ? (
              <>
                {isGeometryEditingOnMap && (
                  <div style={styles.noteBox}>
                    Haritada konumu sürükleyerek düzenleyebilirsin.
                    İşin bitince Kaydet butonuna bas.
                  </div>
                )}

                <div style={styles.label}>İsim</div>
                <input
                  style={styles.input}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />

                <div style={styles.formRow}>
                  <div style={styles.colorColumn}>
                    <div style={styles.label}>Renk</div>
                    <input
                      style={styles.colorInput}
                      type="color"
                      value={form.color}
                      onChange={(e) =>
                        setForm({ ...form, color: e.target.value })
                      }
                    />
                  </div>

                  <div style={styles.noteColumn}>
                    <div style={styles.label}>Not</div>
                    <textarea
                      style={styles.textarea}
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      placeholder="Açıklama gir..."
                    />
                  </div>
                </div>

                <div style={styles.popupButtons}>
                  <button
                    onClick={() => setIsEditing(false)}
                    style={{ ...styles.button, ...styles.cancelButton }}
                    disabled={isSaving}
                  >
                    İptal
                  </button>

                  <button
                    onClick={updateSelectedGeometry}
                    style={{ ...styles.button, ...styles.saveButton }}
                    disabled={isSaving}
                  >
                    {isSaving ? "Güncelleniyor..." : "Kaydet"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>İsim</div>
                  <div style={styles.infoValue}>{pendingData?.name || "-"}</div>
                </div>

                <div style={styles.formRow}>
                  <div style={styles.colorColumn}>
                    <div style={styles.label}>Renk</div>
                    <input
                      type="color"
                      value={pendingData?.color || "#2563eb"}
                      disabled
                      style={styles.readonlyColor}
                    />
                  </div>

                  <div style={styles.noteColumn}>
                    <div style={styles.label}>Not</div>
                    <div style={styles.noteBox}>
                      {pendingData?.description || "Not girilmemiş."}
                    </div>
                  </div>
                </div>

                {pendingData?.originalType === "Polygon" && (
                  <div style={styles.analysisTotal}>
                    <span>Toplam Point Sayısı:</span>
                    <span>{analysisResult?.pointCount ?? 0}</span>
                  </div>
                )}

                <div style={styles.popupButtons}>
                <button
  onClick={() => setIsEditing(true)}
  style={styles.editButton}
>
  Bilgileri Düzenle
</button>

<button
  onClick={startGeometryEdit}
  style={styles.editButton}
>
  Konumu Düzenle
</button>

                  <button
                    onClick={deleteSelectedGeometry}
                    style={styles.deleteButton}
                  >
                    Sil
                  </button>

                  <button onClick={closePopup} style={styles.closeButton}>
                    Kapat
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {saveSuccess && !isInventoryAnalysis && !isGeometryInfo && (
          <>
            <div style={styles.resultTitle}>
              {getGeometryName()} kaydedildi
            </div>

            {pendingData?.type === "Polygon" && (
              <div style={styles.analysisTotal}>
                <span>Polygon içindeki envanter sayısı:</span>
                <span>{inventoryCount}</span>
              </div>
            )}

           <div style={styles.popupButtons}>
    <button
        onClick={closePopup}
        style={styles.primaryButton}
    >
        Kapat
    </button>
</div>
          </>
        )}
      </div>
    </div>
  );
}

export default GeometryPopup;