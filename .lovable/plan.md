## Ziel

Den Radius der Niederschlags-Sichtbarkeit (Messung MeteoSchweiz **und** Prognose ICON-CH1/CH2) auf das **Doppelte** vergrössern — also doppelte Lat-/Lon-Ausdehnung um das bisherige Zentrum (≈ 47.575 N / 9.35 E).

Bisherige Bbox: lat 47.30–47.85, lon 8.85–9.85 (≈ 61 km × 75 km).
Neue Bbox: lat **47.025–48.125**, lon **8.35–10.35** (≈ 122 km × 150 km).

## Änderungen

### 1. `src/lib/radar.functions.ts` (Prognose-Grid)

- `BBOX` aktualisieren auf `{ minLat: 47.025, maxLat: 48.125, minLon: 8.35, maxLon: 10.35 }`.
- Zellgrösse beibehalten → Punktzahl ebenfalls verdoppeln, damit die Open-Meteo-Auflösung pro km gleich bleibt:
  - `GRID_LON: 20 → 40`
  - `GRID_LAT: 12 → 24`
- Konsequenz: Open-Meteo-Punkte 240 → 960. Der GitHub-Actions-Ingest (`ingest_openmeteo.py`) ruft entsprechend mehr Locations ab; läuft alle 5 min, sollte mit Multi-Location-Requests pro Call weiterhin im Free-Tier liegen.

### 2. `scripts/ingest_openmeteo.py` (Default-Bbox)

- Defaults anpassen:
  - `BBOX_MIN_LAT`: 47.30 → 47.025
  - `BBOX_MAX_LAT`: 47.85 → 48.125
  - `BBOX_MIN_LON`: 8.85 → 8.35
  - `BBOX_MAX_LON`: 9.85 → 10.35
- Falls dort eine feste Schrittweite/Punktzahl-Konstante existiert, an `GRID_LON=40` / `GRID_LAT=24` angleichen (verifizieren beim Implementieren).

### 3. `scripts/ingest_radar.py` (MeteoSchweiz-Messung, R2-PNG-Output)

- `BBOX_WGS = {"minLon": 8.35, "maxLon": 10.35, "minLat": 47.025, "maxLat": 48.125}`.
- `OUT_W` / `OUT_H` ggf. proportional erhöhen, damit die Pixel-Auflösung des MCH-Reprojection-Outputs gleich bleibt (wenn sie aktuell auf die alte Bbox dimensioniert sind). Beim Implementieren prüfen — wenn sie heute z. B. ~200×110 sind, auf ~400×220.

### 4. `src/components/maps/radar-map.tsx` (Karten-Panning-Grenzen)

- `maxBoundsExt` mitziehen, damit man die nun grössere Sichtbarkeit auch erreichen kann:
  - alt: `[[47.25, 8.78], [47.90, 9.92]]`
  - neu: `[[46.97, 8.27], [48.18, 10.42]]` (etwas grösser als die neue Daten-Bbox).
- `regionBounds` (Startausschnitt Oberthurgau) **bleibt unverändert** — der Default-Zoom soll weiterhin auf die Region zentriert sein.
- Farb-/Transparenz-Konstanten, Tropfen-Icons etc. unverändert.

## Nicht betroffen

- Farbskala, Alpha-Werte, Smoothing/Advection-Logik, Timeline-UI.
- Region-/Lake-/Switzerland-GeoJSONs.

## Hinweis Workflow

Die neue Bbox wird erst nach dem nächsten GitHub-Actions-Lauf von `openmeteo-ingest.yml` und `radar-ingest.yml` im R2-Cache sichtbar — bis dahin liefert die Karte den bisherigen kleineren Ausschnitt.
