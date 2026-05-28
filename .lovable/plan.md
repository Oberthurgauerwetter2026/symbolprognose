## Diagnose

Beide Workflows (`openmeteo-ingest.yml`, `openmeteo-symbol.yml`) brechen exakt bei ~15m ab — der `timeout-minutes: 15` ist erreicht. Auslöser: das Grid steht auf `GRID_LAT=18` / `GRID_LON=28` = **504 Punkte** (4× mehr als der Script-Default 126), während Chunk-Grössen und `BATCH_SLEEP_S` (Default 6s) unverändert blieben.

Pro Run fallen damit an:
- **phase1** (`CHUNK_PHASE1=15`): 34 Batches → ~198s Sleeps + 34 Requests
- **phaseC** (`CHUNK_PHASEC=40`): 13 Batches
- **phaseA** (Symbol-Workflow, `CHUNK_PHASEA=20`): 26 Batches

Bei jedem 429 vom Open-Meteo-Limiter kommen 65–120s Backoff dazu — der Job überschreitet 15 min und wird gekillt. Keine Code-Bugs, reines Kapazitätsproblem.

## Fix

1. **`.github/workflows/openmeteo-ingest.yml`**
   - `timeout-minutes: 15` → `25`
   - Env ergänzen: `CHUNK_PHASE1: "30"`, `CHUNK_PHASEC: "60"`, `BATCH_SLEEP_S: "3"`

2. **`.github/workflows/openmeteo-symbol.yml`**
   - `timeout-minutes: 15` → `25`
   - Env ergänzen: `CHUNK_PHASEA: "40"`, `BATCH_SLEEP_S: "3"`

Open-Meteo erlaubt bis zu 1000 Koordinaten pro Bulk-Request, d.h. die grösseren Chunks sind unkritisch; der reduzierte `BATCH_SLEEP_S` bleibt unter dem Minutenlimit.

## Verifikation

Nach dem nächsten Scheduled-Run (oder manuellem Dispatch):
- Job-Dauer < 15 min, grüner Status
- `/api/public/debug/r2-cache` zeigt frische `generatedAt` und plausible `counts.phase1`/`phaseA`

Keine Änderungen an `scripts/ingest_openmeteo.py` oder am App-Code nötig.