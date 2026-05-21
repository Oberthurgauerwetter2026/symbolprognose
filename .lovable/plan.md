## Ziel

Karte stärker auf die Region fokussieren und visuell moderner gestalten. Nur `src/components/region-map.tsx` wird angepasst — Wetter-Logik und Marker-Daten bleiben.

## Änderungen

**1. Fokus auf Region (Bezirk Arbon + Münsterlingen)**

- Karte automatisch an die GeoJSON-Bounds anpassen via `bounds` Prop bzw. `map.fitBounds(layer.getBounds(), { padding: [20,20] })`.
- `minZoom` auf die berechneten Bounds setzen und `maxBounds` mit leichtem Padding → User kann nicht aus der Region rauspannen.
- Statt `World Topo Map` die deutlich dezentere **Esri "World Gray Canvas"** als Basemap (lässt Region und Wetter-Marker dominieren, wirkt moderner). Labels-Overlay (`World_Boundaries_and_Places`) zusätzlich, damit Ortsnamen lesbar bleiben.

**2. Modernere Region-Darstellung**

- Aussenmaske: ein zweites GeoJSON-Layer (Welt-Rechteck mit Region als Loch) füllt alles ausserhalb der Region halbtransparent mit dunklem Navy → Region wird optisch "ausgestanzt" und hervorgehoben.
- Region-Outline: kräftigere Linie (`weight: 2.5`, `color: #0c2340`), kein Fill (Basemap bleibt sichtbar), dezenter `dashArray` weglassen.
- Container: `rounded-2xl`, weicher Shadow (`shadow-lg`), kein Border — wirkt moderner.

**3. Modernere Marker-Karten**

- Glas-Look: `background: rgba(255,255,255,0.85)`, `backdrop-filter: blur(8px)`, `border-radius: 14`, subtilerer Shadow (`0 8px 24px rgba(12,35,64,0.12)`).
- Kleiner farbiger Akzent-Dot links der Temperatur (Primary `#5cbdb9`).
- Ortsname als kleine Pille oberhalb (uppercase, letter-spacing) statt darunter — wirkt redaktioneller.
- Wind-Pfeil als echtes SVG (Pfeil-Glyph statt `↓`-Zeichen), gleiche Rotation.

## Technische Details

- `MapContainer` bekommt `bounds` aus `L.geoJSON(REGION).getBounds()` (in `useMemo`), `boundsOptions={{ padding: [24,24] }}`, `maxBounds` = `bounds.pad(0.15)`, `maxBoundsViscosity: 1.0`, `minZoom` = aus `fitBounds`-Ergebnis (vereinfacht: `minZoom={10}`), `zoomControl={false}` + `<ZoomControl position="topright" />` für moderneres Layout.
- Aussenmaske: `turf`-frei lösen — Polygon mit Welt-Ring als äusserer Ring und Region-Koordinaten als inneren Ring (Loch). Da die Region eine `FeatureCollection` mit mehreren Polygonen ist, einfacher: alle Region-Features als Holes in ein Welt-Polygon einfügen. Code direkt in `useMemo` aus `REGION.features` ableiten.
- Tile-URLs:
  - Base: `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`
  - Labels: `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}` (zweiter `<TileLayer>` darüber, `pane="overlayPane"` nicht nötig — Default-Stapel reicht).

## Nicht verändert

- 4 Spots, Wetter-Fetch, Stunden-Refresh, GeoJSON-Datei.
