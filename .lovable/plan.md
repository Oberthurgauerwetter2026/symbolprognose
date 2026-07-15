## Ziel

Prognose-Ns-Felder sollen die **native ICON-CH1-Auflösung** (~1 km) haben, damit die Zell-Grössen und Formen mit der Messung (MCH CombiPrecip ~1 km) übereinstimmen. Heute rendert die Prognose auf einem 22×36-Punkt-Grid (~5-7 km) — deutlich gröber als die Modellauflösung.

## Ausgangslage

- `scripts/ingest_openmeteo.py`: `GRID_LAT=22`, `GRID_LON=36` (~792 Punkte) — im Workflow `.github/workflows/openmeteo-ingest.yml` hart gesetzt.
- `src/lib/radar.functions.ts`: baut aus diesen Punkten das Prognose-Grid und schickt pro Frame `values[792]` an den Client.
- Native ICON-CH1 über die Region 46.85–48.30 °N × 8.15–10.55 °E → ~161×184 Punkte ≈ **30 000 Punkte**.
- Direkt 30 000 Grid-Werte pro Frame × ~192 Frames zum Client zu schicken ist nicht tragbar (>50 MB pro Radar-Fetch).
- Die Messung löst das Problem bereits: der Ingest **rastert PNGs** und legt sie in R2 ab; der Client zeigt sie via `MeasurementCanvasOverlay` in nativer Auflösung.

## Fix — Prognose auf denselben PNG-Pfad wie die Messung heben

1. **Ingest verdichten**: In `scripts/ingest_openmeteo.py` und `.github/workflows/openmeteo-ingest.yml` `GRID_LAT ≈ 161`, `GRID_LON ≈ 184` setzen. Die vier Phasen abkoppeln:
   - Nur `phase1` (ICON-CH1 `minutely_15`, für Radar) läuft auf dem neuen Native-Grid.
   - `phase2`/`phaseA`/`phaseC` (Wind, Symbolprognose, Bias) bleiben auf dem alten ~22×36-Grid — sie brauchen keine 1-km-Auflösung. Der Grid-Aufbau in `build_grid()` wird pro Phase parametrisiert.
   - `chunk_p1` auf `≈200` erhöhen (Open-Meteo-Bulk-Limit), Backoff bleibt. Erwartet: ~150 Batches, laufen mit dem bestehenden ThreadPool durch.
2. **Prognose-PNGs im Ingest rastern**: In `scripts/ingest_openmeteo.py` nach `phase1` die 15-min-Frames (–3 h … +48 h) direkt als PNG mit derselben Farbskala wie die Messung (`render_png` aus `scripts/ingest_radar.py` extrahieren/teilen) auf ein einheitliches Web-Mercator-Raster rendern. Upload nach `radar/forecast/<ISO>.png` in R2.
3. **Manifest erweitern**: `radar/frames.json` bekommt zusätzliche Einträge mit `precipUrl: radar/forecast/...` und einem neuen Feld `source: "icon-ch1"`. Der Client-Server-Fn `getRadarFrames` liest das Manifest wie bisher und leitet die Forecast-Frames als PNG-Frames weiter — die Wind-/Interpolationslogik im Server-Fn wird für diese Frames abgeschaltet, Values-Arrays entfallen.
4. **Client passt sich automatisch an**: `radar-map.tsx` rendert `precipUrl`-Frames bereits via `MeasurementCanvasOverlay` — Prognose sieht dann pixelgenau wie die Messung aus, gleiche Farbbänder, gleiche Ränder. Die neu eingebaute 3×3-Boxcar-Glättung für Prognose-Grids kann wieder entfernt werden (nicht mehr nötig).
5. **Cache-/Grid-Kompatibilität**: `openmeteo-cache.server.ts`/`radar.functions.ts` erkennt via `points.length` weiterhin das ~792-Punkt-Grid (für Wind & Co.); das dichte Prognose-Grid landet nicht mehr in `phase1`-Werten, sondern ausschliesslich in den PNGs.

## Kosten & Risiken

- **Open-Meteo API**: `phase1`-Calls steigen von ~53 auf ~150 Batches pro Ingest-Zyklus. Andere Phasen unverändert. Bleibt im Rahmen des Free-/Non-Commercial-Kontingents; Backoff/Retry bleibt aktiv.
- **R2**: ~192 PNGs à ~30–60 KB = ~10 MB je Ingest — vernachlässigbar; Purge-Job (analog `purge_all_radar_pngs`) räumt Alt-Files.
- **Ingest-Laufzeit**: +30–60 s pro Zyklus (150 Batches statt 53, plus PNG-Rasterung).
- **Client-Payload**: sinkt drastisch (nur URLs & Metadaten), Animation läuft über Bild-Prefetch wie heute bei der Messung.
- **Rückweg / Kill-Switch**: `GRID_LAT`/`GRID_LON` per Env-Var überschreibbar; bei Ausfall Fallback auf bestehenden R2-Cache und niedrige Auflösung.

## Scope

- `scripts/ingest_openmeteo.py` — Grid-Parametrisierung pro Phase, PNG-Rendering für Prognose, Manifest-Erweiterung.
- `scripts/ingest_radar.py` — `render_png` in ein gemeinsames Helper-Modul extrahieren (oder direkt importieren).
- `.github/workflows/openmeteo-ingest.yml` — neue `GRID_LAT_PHASE1`/`GRID_LON_PHASE1`, Timeouts.
- `src/lib/radar.functions.ts` — Manifest-Frames mit `source: "icon-ch1"` als PNG-Frames durchreichen, Interpolation/Bias-Correction für Frames mit `precipUrl` überspringen.
- `src/components/maps/radar-map.tsx` — 3×3-Boxcar-Smoothing für Prognose-Frames entfernen (nicht mehr benötigt).

**Kein** Change an Farbskala (`SCALE`), Timeline-UI, Wind-/Symbol-Pipeline oder Messungs-Pipeline.
