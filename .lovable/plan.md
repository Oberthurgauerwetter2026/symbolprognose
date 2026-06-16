## Open-Meteo Ingest: Timeout-Failures in phase1 fixen

**Symptom:** Workflow-Log zeigt `phase1 batch 17/27 … Read timed out. (read timeout=15.0)` für mehrere Batches gleichzeitig. Backoff-Retries laufen, kosten aber Zeit und Tageskontingent.

**Ursachen:**
- Connect-Timeout-Default 15 s zu knapp, wenn Open-Meteo unter Last ist.
- Read-Timeout 120 s zu knapp für 30-Punkt-Batches mit minutely_15 (132 Forecast-Steps × 2 Vars + 33 h hourly Wind).
- 2 parallele 30er-Batches verschärfen die Backend-Last.

### Edit

Nur `.github/workflows/openmeteo-ingest.yml`, env-Block des `ingest`-Jobs:

```yaml
CHUNK_PHASE1: "15"        # war 30
CHUNK_PHASEC: "60"        # unverändert
BATCH_SLEEP_S: "3"        # unverändert
OM_CONNECT_TIMEOUT: "30"  # NEU (Default war 15)
OM_READ_TIMEOUT: "300"    # war 120
FETCH_WORKERS: "1"        # war 2
```

Alle anderen ENVs (BBOX, GRID, SKIP_PHASEA=1) bleiben.

### Kein Code-Change

`scripts/ingest_openmeteo.py` liest `OM_CONNECT_TIMEOUT` / `OM_READ_TIMEOUT` bereits und hat 7-stufigen Backoff — keine Anpassung nötig.

### Verifikation

1. GitHub → Actions → **Open-Meteo Cache Ingest** → **Run workflow**.
2. Log: erwartet `phase1 batch N/54 ok` durchgehend ohne `Read timed out`.
3. Laufzeit phase1 ~4–5 min (war ~2 min ohne Retries, ~10+ min mit Retries).
4. R2-Datei `openmeteo/forecast.json` hat frisches `generatedAt`.

### Nicht im Scope

- `scripts/ingest_mch_local_forecast.py` (separater Workflow, vorherige Runde gefixt).
- UI-Quellenangaben in `weather-widget.tsx` (warten bis local_forecast verifiziert Daten liefert).
