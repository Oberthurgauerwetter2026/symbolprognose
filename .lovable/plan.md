## Ziel

Niederschlags-Daten-Bbox vergrössern von heute
`47.30–47.85 N / 8.85–9.85 E` (~60 × 75 km, nur Oberthurgau) auf
`46.85–48.30 N / 8.15–10.55 E` (~160 × 180 km). Damit reicht die Abdeckung bis Süd-Schwarzwald/Stuttgart-Süd im Norden, Bregenz/Arlberg im Osten, Gotthardraum im Süden und Zürich-Westrand im Westen — über die Landesgrenzen hinaus.

Gilt für **beide** Quellen: MeteoSchweiz-Radar (CPC-Resampling) und ICON-CH1 via Open-Meteo. Ausserhalb der MeteoSchweiz-Radarabdeckung (CH + Grenzzone) bleiben Radar-Pixel naturgemäss leer; Open-Meteo liefert dort ICON-CH1/ICON-EU automatisch.

## Änderungen

### 1) `scripts/ingest_radar.py`

- `BBOX_WGS` neu:
  `{ "minLon": 8.15, "maxLon": 10.55, "minLat": 46.85, "maxLat": 48.30 }`
- `OUT_W, OUT_H = 1024, 768` (vorher 768 × 512) — hält ~1 km/px bei der grösseren Fläche, PNG bleibt < ~250 kB.
- `RADAR_INGEST_VERSION` auf `"v5-bbox-extended"` setzen.
- `.github/workflows/radar-ingest.yml`: `EXPECTED_RADAR_INGEST_VERSION` ebenfalls auf `"v5-bbox-extended"` heben (Version-Guard).

### 2) `scripts/ingest_openmeteo.py` (via Workflow-ENV)

In `.github/workflows/openmeteo-ingest.yml`:
- `BBOX_MIN_LAT: "46.85"`, `BBOX_MAX_LAT: "48.30"`
- `BBOX_MIN_LON: "8.15"`, `BBOX_MAX_LON: "10.55"`
- `GRID_LAT: "18"`, `GRID_LON: "28"` (= 504 Punkte; Spacing ~0.085° lat ≈ 9.5 km, ~0.089° lon ≈ 6.8 km — etwas gröber als heute, aber bewältigbar im Open-Meteo-Free-Tier inkl. Chunking).
- Gleiche Anpassung in `.github/workflows/openmeteo-symbol.yml` (Symbolprognose-Job), damit Punkte zusammenpassen.

### 3) `src/components/maps/radar-map.tsx`

- `maxBoundsExt` neu:
  `[[46.80, 8.10], [48.35, 10.60]]` (knapp grösser als Daten-Bbox).
- `regionBounds` (Standardausschnitt beim Laden) **unverändert** lassen — Karte startet weiterhin auf Oberthurgau, User kann rauszoomen/pannen bis zur neuen Bbox.
- `MinZoom` von 9 auf 8 senken, damit die ganze neue Fläche aufs Mobile-Display passt.
- Frontend liest `data.imageBbox` aus `radar/frames.json` automatisch → keine harten Koordinaten im Overlay anzupassen.

## Auswirkungen

- Erster Ingest-Run nach Deploy schreibt PNGs mit neuer Bbox. Alte PNGs im R2 zeigen weiterhin alte Bbox bis sie nach `RADAR_RETENTION_HOURS` (24 h) verschwinden — das Frontend mischt sie aber nicht, weil `imageBbox` aus dem Manifest pro Frame verwendet wird. Falls Mischanzeigen auffallen: einmalig `radar/*.png` im R2 löschen und Workflow manuell triggern.
- Open-Meteo-Grid wächst von 240 → 504 Punkte. Chunking im Script übernimmt das; Laufzeit pro Ingest steigt ~2×, bleibt im 15-min-Timeout.
- Radar-PNGs etwas grösser (~150–250 kB statt ~80–150 kB) — vertretbar bei 144 Runs/Tag.

## Nicht betroffen

- Symbolprognose-Logik, Wetter-Icons, MOSMIX-Stationen, Pollen-/Wind-/Lokal-Karten.
- Standard-Kartenausschnitt beim Öffnen (bleibt Oberthurgau).
