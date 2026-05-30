## Ziel

Zusätzlich zum bestehenden ICON-CH1-Niederschlagsraster (12×20, ~5 km) einen zweiten Forecast-Layer **AROME-France-HD** (Meteo-France, 1.3 km nativ) anbieten, der auf einem dichten Grid geholt, **server-seitig zu PNG-Frames gerendert** und im Browser als `ImageOverlay` angezeigt wird — analog zur bestehenden CPC-Radar-PNG-Logik (`precipUrl`).

Damit:
- weniger weichgespülte Optik (echte Modellauflösung statt Canvas-Interpolation aus 240 Punkten),
- konvektiv mehr Niederschlag sichtbar (AROME setzt Schauer aggressiver als ICON-CH1),
- keine Browser-Berechnung mehr → robuster, kein „Hänger".

## Architektur

```text
GitHub Action (alle 15 min)
  └─► scripts/ingest_arome.py
        ├─► Open-Meteo (AROME-HD, hourly precipitation, +0…+42h)
        │     dichtes Grid 40×60 = 2400 Punkte über Oberthurgau
        ├─► pro Stunde: numpy + Pillow → PNG-Frame (RGBA, transparent)
        │     Farbskala identisch zu bestehender Radar-Skala
        └─► R2: arome/frames/<ts>.png + arome/frames.json (Manifest)

Worker / radar.functions.ts
  └─► liest arome/frames.json zusätzlich zu icon-ch1/icon-ch2
  └─► neue Source "arome-hd", Frames mit precipUrl (ImageOverlay)

UI / radar-map.tsx
  └─► neuer Toggle „Modell": ICON-CH1 (default) ↔ AROME-HD
```

## Umsetzung

### 1. Ingest-Script `scripts/ingest_arome.py` (neu)

- BBox: 47.20–47.95 / 8.70–10.00 (etwas weiter als ICON-Grid, damit AROME nicht am Rand abgeschnitten wirkt)
- Grid: 40×60 = 2400 Punkte (~1.5 km Abstand)
- Open-Meteo-Call: `models=meteofrance_arome_france_hd`, `hourly=precipitation`, `forecast_hours=42`, in Chunks à 50 Punkte (≈ 48 Batches × 3 s Pause → ~2.5 min, lockerer unter 600 calls/min Limit)
- Pro Stunde:
  - 2400 Werte → 60×40 numpy-Array
  - **Bicubic-Upsampling** auf 480×320 px mit Pillow
  - Farb-LUT identisch zur bestehenden Radar-Palette (transparent < 0.1 mm/h, blau → grün → gelb → rot → magenta)
  - PNG (RGBA) nach `r2://arome/frames/<isoTs>.png` (max-age=900)
- Manifest `arome/frames.json`:
  ```json
  {
    "version": "arome-hd-v1",
    "generatedAt": "...",
    "imageBbox": { "minLat": 47.20, "maxLat": 47.95, "minLon": 8.70, "maxLon": 10.00 },
    "frames": [{ "t": "2026-05-30T10:00:00Z", "url": "https://<r2>/arome/frames/2026-05-30T10-00-00Z.png" }, ...]
  }
  ```

### 2. Workflow `.github/workflows/arome-ingest.yml` (neu)

- `workflow_dispatch` (Cron-Worker triggert), `concurrency: cancel-in-progress: true`
- Timeout 15 min, Python 3.12, deps: `boto3 requests numpy Pillow`
- Secrets: R2_*
- AROME-Modell wird alle 3 h aktualisiert → kein Sinn alle 5 min; 15 min Intervall reicht

### 3. Cron-Worker (`cron-worker/src/index.ts`)

- Neuer Env `AROME_TARGET_URL`
- In `scheduled`: `minute % 15 === 0` → zusätzlich `triggerEndpoint(AROME_TARGET_URL, ...)`
- `wrangler.toml`: AROME_TARGET_URL ergänzen
- Manueller Endpoint `/run/arome`

### 4. Server-Route `src/routes/api/public/arome/ingest-trigger.ts` (neu)

- Analog zu `radar/ingest-trigger.ts`: Header `x-trigger-secret`, dispatched GitHub-Workflow `arome-ingest.yml` via existierender Dispatch-Helper (`src/lib/radar-dispatch.server.ts` als Vorlage → `arome-dispatch.server.ts`)

### 5. Cache-Reader `src/lib/arome-cache.server.ts` (neu)

- Holt `arome/frames.json` aus R2 (analog `openmeteo-cache.server.ts`), 60 s in-memory TTL

### 6. Radar-Integration `src/lib/radar.functions.ts`

- Neuer Frame-`source: "arome-hd"`
- Funktion `getAromeFrames()` liest Manifest und mappt auf `RadarFrame[]` mit `precipUrl` + `imageBbox` aus Manifest
- Bestehende `getRadarFrames` bekommt optionalen Parameter `model: "icon" | "arome"` (default `icon`)

### 7. UI `src/components/maps/radar-map.tsx`

- Toggle oberhalb der Karte: **ICON-CH1** (jetzt) | **AROME-HD** (neu)
- State `model` → wird an `useRadarFrames({ model })` weitergegeben
- AROME-Frames rendern als `ImageOverlay` (Code existiert bereits für CPC-PNG-Frames)

## Technische Details

- **Open-Meteo-Quote**: AROME-HD 2400 Punkte × 1 Call alle 15 min = 96 × 2400 = 230k pts/Tag. Bei Chunks von 50 sind das 48 Calls/Run × 96 = ~4600 Calls/Tag. Im Free-Tier (10k/Tag) noch im grünen Bereich; bei Engpass auf 30 min hochsetzen.
- **PNG-Größe**: 480×320 RGBA ≈ 30–80 kB pro Frame, ~42 Frames/Run ≈ 2 MB R2-Write pro Tick. R2-Free-Tier locker ausreichend.
- **Farbskala**: aus `src/lib/weather.ts` / bestehendem Canvas-Renderer extrahieren, in Python als Numpy-LUT duplizieren (gleicher Look).
- **CORS**: R2-Public-Bucket bereits konfiguriert (von Radar-CPC).
- **Backwards-Compat**: Default bleibt ICON-CH1 — bestehende Embeds (`/embed/radar`) unverändert.

## Out of Scope (für später)

- Hagel/POH-Overlay für AROME (Modell liefert nicht direkt).
- Phase-2 ICON-CH2 als PNG-Layer (gleiche Technik möglich, aber separater Plan).
- Animations-Sync zwischen ICON- und AROME-Layer beim Toggle.

## Voraussetzungen vor Implementation

- Secret `RADAR_TRIGGER_SECRET` für AROME-Endpoint wiederverwenden (existiert).
- Nach Merge: Cron-Worker via `cron-worker-deploy.yml` neu deployen, App publishen.
