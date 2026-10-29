import { TileLayer } from "react-leaflet";

/**
 * Hintergrund für das Ausland (DE/AT/FR): swisstopo-Kacheln enden an der
 * Landesgrenze. Darunter liegt eine helle Basiskarte ohne Beschriftung
 * (Gewässer, Flüsse) plus globale Reliefschattierung. Die Schweiz wird von der
 * swisstopo-Ebene darüber verdeckt; das Ausland wird durch die bestehende
 * Aussenmaske gleichmässig abgedämpft (SRF-/MeteoSchweiz-Stil).
 */
export function ForeignReliefLayers() {
  return (
    <>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png"
        subdomains="abcd"
        maxZoom={18}
        opacity={0.9}
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/">CARTO</a>'
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={13}
        maxZoom={18}
        opacity={0.4}
        attribution="Relief © Esri"
      />
    </>
  );
}
