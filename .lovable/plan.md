## Ziel
Neue Region "Schweiz HD (Tag)" mit NASA GIBS VIIRS Truecolor (375 m/Pixel) als vierte Auswahl im Satellitenkarte.

## Datenquelle
- NASA GIBS WMTS (frei, kein Key):
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/{TIME}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
- Auflösung: 375 m (native), Update: 1×/Tag (nach Satellitenüberflug am späten Vormittag UTC)
- Attribution: "NASA GIBS · VIIRS NOAA-20 (Corrected Reflectance)"

## Änderungen

### 1. `src/lib/satellite.functions.ts`
- Neue Region `alpen-ch-hd`:
  - `provider: "gibs"` (neues Feld auf `SatelliteRegion`)
  - `layer: "VIIRS_NOAA20_CorrectedReflectance_TrueColor"`
  - `tileMatrixSet: "GoogleMapsCompatible_Level9"`
  - center `[46.7, 8.5]`, zoom 7
  - `stepMinutes: 1440` (täglich), `latencyMinutes: 12*60` (Vortag als sicher verfügbar)
- Bestehende EUMETSAT-Regionen bekommen implizit `provider: "eumetsat-wms"` (Default).
- `buildFrames` erweitert: für GIBS erzeugt es 5 tägliche Frames (heute-1 … heute-5), Label `DD.MM.`, `time` als `YYYY-MM-DD`.
- Manifest liefert zusätzlich `provider` und (bei GIBS) `tileMatrixSet` mit.

### 2. `src/components/maps/satellite-map.tsx`
- Im `FrameStack` je nach `manifest.provider` einen anderen `TileLayer` bauen:
  - EUMETSAT: unveränderte HiDPI-WMS-Kachel (bestehend).
  - GIBS: `L.tileLayer(templateUrl, { tileSize: 256, opacity, attribution })` — VIIRS liefert 256er JPG-Kacheln nativ, das ist bereits scharf ohne Supersampling.
- Timeline-Label unter der Karte zeigt für GIBS das Datum statt Uhrzeit (kommt automatisch aus `frame.label`).
- Fallback-Logik (`tileerror` → `mtg_fd`) bleibt EUMETSAT-only.

### 3. Region-Auswahl-UI
Keine Änderung — neuer Eintrag erscheint automatisch im bestehenden Dropdown/Segmented Control aus `SATELLITE_REGIONS`.

## Technische Details
- Kein zusätzlicher Secret nötig, GIBS ist offen.
- Server-Route bleibt gleich (Server-Function `getSatelliteManifest`), nur der Return erhält `provider`.
- Kartendarstellung: Da Zoom 7 auf CH ~600 m/px zeigt und VIIRS 375 m nativ ist, wirkt das Bild deutlich schärfer als MTG.
- Nachts / bei Wolken über CH ist das Vortagsbild "veraltet", aber genau dafür bleibt die bestehende Live-MTG-Ansicht als Standard.