function LayerControl({ styles, visibleLayers, toggleLayer }) {
  return (
    <div style={styles.layerControl}>
      <div style={styles.layerTitle}>Katman Kontrolü</div>

      <label style={styles.layerItem}>
        <input
          type="checkbox"
          checked={visibleLayers.Point}
          onChange={() => toggleLayer("Point")}
          style={styles.layerCheckbox}
        />
        Point
      </label>

      <label style={styles.layerItem}>
        <input
          type="checkbox"
          checked={visibleLayers.LineString}
          onChange={() => toggleLayer("LineString")}
          style={styles.layerCheckbox}
        />
        Line
      </label>

      <label style={styles.layerItem}>
        <input
          type="checkbox"
          checked={visibleLayers.Polygon}
          onChange={() => toggleLayer("Polygon")}
          style={styles.layerCheckbox}
        />
        Polygon
      </label>
    </div>
  );
}

export default LayerControl;