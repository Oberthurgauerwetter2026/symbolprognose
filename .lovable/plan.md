## Diagnose

Der Log zeigt eindeutig: das 120×140 Dense-Grid (16 800 Punkte / 84 Batches à 200) sprengt das Open-Meteo Minutenlimit massiv. Bereits ab Batch 3 kommen `429 Minutely API request limit exceeded` + `Read timed out`. Die Retries mit Backoff (bis 142 s) stapeln sich, der Run läuft ins 60-min-Timeout des Workflows, und `write_forecast_manifest` wird nie erreicht → `radar/forecast-frames.json` bleibt 404.

Zusätzlicher Nebeneffekt: die 84 langen Batches blockieren auch `phaseC` / `phase1_sparse`, sodass der gesamte Cache veraltet (85 min stale bereits beobachtet).

## Fix (zweistufig)

### 1. Dense-Grid drastisch reduzieren

In `.github/workflows/openmeteo-ingest.yml`:

```yaml
# vorher
GRID_LAT_DENSE: "120"
GRID_LON_DENSE: "140"
CHUNK_PHASE1: "200"
FETCH_WORKERS: "2"

# nachher
GRID_LAT_DENSE: "48"    # ~3 km, 48×56 = 2 688 Punkte
GRID_LON_DENSE: "56"
CHUNK_PHASE1: "150"     # 18 Batches statt 84
FETCH_WORKERS: "1"      # keine parallelen Bursts → Minutenlimit sicher
```

Rechnung: 2 688 / 150 ≈ **18 Batches sequentiell** statt 84 parallel. Open-Meteo erlaubt ~600 Calls/Minute pro IP — 18 sequentielle Requests laufen problemlos in <2 min durch, mit reichlich Puffer für phaseC und Sparse.

Auflösung sinkt von ~1 km auf ~3 km — für ein 2-h-Prognose-PNG des Oberthurgaus visuell kaum unterscheidbar, weil das ICON-CH1-Native-Grid ohnehin geglättet wird.

### 2. Harte Timeout-Grenze + Sparse-Fallback aktiv lassen

In `scripts/ingest_openmeteo.py` bleibt der bereits vorhandene Sparse-Fallback (22×36) in `rasterize_forecast_pngs` unverändert — falls das kleinere Dense-Grid trotzdem einmal >20 % Ausfälle produziert (`PHASE1_DENSE_MAX_FAIL_PCT=20`), rendert der Job die PNGs aus dem Sparse-Cache. So ist `radar/forecast-frames.json` **garantiert** vorhanden.

Zusätzlich: `OM_READ_TIMEOUT` von 300 s auf 60 s senken, damit hängende Reads schneller als Fehler zählen und der Retry-Backoff greift, statt 5 min stumm zu blockieren.

### 3. Manuell dispatchen und verifizieren

Nach dem Merge:

1. `workflow_dispatch` auf `openmeteo-ingest.yml` auslösen (Cron-Worker macht das ohnehin alle 30 min).
2. `/api/public/debug/r2-cache` prüfen:
   - `generatedAt` frisch (< 10 min)
   - `forecast.frameCount > 0`
   - `forecast.futureFrameCount > 0`
3. `/karten/radar` prüfen: Timeline zeigt Frames über `now` hinaus.

## Was NICHT geändert wird

- Rasterizer-Logik, R2-Upload, Sparse-Grid (22×36), Symbol-Workflow, Client-Fallback — alle bleiben unverändert. Nur Grid-Größe, Chunk-Größe, Worker-Anzahl und Read-Timeout im Workflow-Env.

## Erwartetes Ergebnis

Ingest läuft in <5 min sauber durch, `radar/forecast-frames.json` wird alle 30 min neu geschrieben, Prognose erscheint auf der Karte. Falls das Minutenlimit weiter zickt, greift der Sparse-Fallback und liefert zumindest niedrig aufgelöste PNGs statt gar keine.
