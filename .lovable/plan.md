## Plan

**Ziel:** Stündlicher Refresh; Kartendarstellung wie im Screenshot (echte Basiskarte mit Ortsnamen, flache Farbbänder, kräftige Grenzen) — **ohne mm-Zahlen in der Fläche**.

### 1. Refresh-Intervall

`src/routes/intern.niederschlag.tsx`:
- `refetchInterval` auf `60 * 60_000` (stündlich).
- `staleTime` auf `30 * 60_000`.
- Header-Text „Auto-Refresh alle 5 Minuten" → „Auto-Refresh stündlich".

### 2. Karte auf Leaflet-Basis umstellen (analog Radar-Prognose)

`src/components/maps/precip-accum-map.tsx` wird umgebaut auf das Setup von `radar-map.tsx`:

- `MapContainer` mit Center `[47.575, 9.35]`, Zoom `9.5`, `maxBounds` auf den Anzeige-BBox, festes Höhen-Verhältnis (~560 px).
- `TileLayer` swisstopo „leichte-basiskarte_reliefschattierung" → OSM-artige Grundkarte mit Ortsnamen wie im Screenshot.
- `GeoJSON`-Overlays: Schweiz-Grenze (kräftig dunkel), Thurgau (fett), Bodensee.
- Akkumulations-Heatmap als `ImageOverlay`: ein Offscreen-Canvas rendert nur die Farbflächen mit **transparentem Hintergrund**, wird via `toDataURL` als Overlay darübergelegt.
- Pro Stundenfenster (12/24/48 h) eine eigene Karte/Card.

### 3. Farben & Banderung wie im Screenshot

- Klassengrenzen 0.3/1/2/5/10/20/30/50/75/100 mm beibehalten.
- Farben enger an die Kachelmann-/MeteoSchweiz-Palette des Screenshots: helle Blautöne → mittel-/dunkelblau → grün → gelb → orange → rot → magenta.
- Volle Deckkraft (`alpha ~ 0.85`), harte Bandkanten, keine Interpolation, kein Blur.

### 4. Keine Zahlen in der Karte

- **Keine** mm-Labels und keine Konturwerte direkt auf der Heatmap.
- Auch keine SPOTS-Pills mehr (Basemap zeigt Ortsnamen bereits).
- Legende mit Klassenwerten bleibt **unterhalb** der Karte.

### 5. PNG-Download

Bleibt funktional (neuer Tab + Speichern-Button). Export wird weiterhin in einem standalone 1280×760 Canvas erzeugt: heller Hintergrund + Heatmap + Thurgau-Outline + Legende + Titel. Basemap-Tiles werden **nicht** ins PNG eingebettet (Tile-Lizenz/CORS); im Export erscheint die Grundkarte als heller, neutraler Hintergrund mit Schweiz- und Thurgau-Konturen. Das ist die robusteste, sandbox-sichere Variante.

### Technische Details

- Neue Funktion `renderHeatmapToDataUrl(payload, w, h)` rendert nur die Farbbänder transparent → `ImageOverlay.url`.
- `ImageOverlay`-`bounds` = Heatmap-BBox des Datengrids, sodass die Lage 1:1 zur Karte passt.
- Keine Änderungen an Auth, Daten-Fetch, Server-Code oder Routing.
- Nur betroffen: `src/components/maps/precip-accum-map.tsx`, `src/routes/intern.niederschlag.tsx`.