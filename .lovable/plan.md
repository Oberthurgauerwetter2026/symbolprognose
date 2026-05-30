## Problem

Der GitHub-Workflow `openmeteo-ingest.yml` wurde nach ~20 min vom Runner gecancelt (`timeout-minutes: 25`). Der Lauf war eigentlich erfolgreich unterwegs (phase1 komplett, phaseC bei Batch 10/14), wurde aber wegen mehrerer 120 s-Read-Timeouts gegen `api.open-meteo.com` zu langsam.

Das erweiterte Grid (22×36 = 792 Punkte) verdoppelt die Batch-Anzahl gegenüber vorher und verträgt sich nicht mehr mit den aktuellen Defaults.

## Massnahmen

1. **Workflow-Budget erhöhen**
   - `.github/workflows/openmeteo-ingest.yml`: `timeout-minutes: 25` → `timeout-minutes: 45`. Nur Schutz vor Hängern, kein normales Limit.

2. **Schnelleres Fail-Fast bei Timeouts**
   - In `scripts/ingest_openmeteo.py` `requests.get(..., timeout=120)` auf `timeout=(15, 45)` (connect, read) ändern.
   - Effekt: ein hängender Request kostet 45 s statt 120 s, der Retry kommt früher dran.

3. **Mehr Batches parallel**
   - In `chunk_fetch` einen kleinen `ThreadPoolExecutor` (z. B. 3 Worker) für die Batches einer Phase verwenden, mit weiterhin sequentiellem Logging.
   - Ergebnisse strikt nach Batch-Index sortiert zurückgeben, damit die Reihenfolge der Punkte stabil bleibt (`phase1[i]` muss weiter zu `pts[i]` passen).
   - `BATCH_SLEEP_S` wird damit obsolet; stattdessen begrenzt der Pool die Parallelität.

4. **PhaseC entlasten**
   - `phaseC` (Bias-Lookback, `optional=True`) ist nicht zeitkritisch für Radar/Nowcast.
   - Falls die Gesamtzeit weiterhin knapp wird: phaseC im 5-min-Workflow nur jeden N-ten Lauf ausführen (z. B. via `phaseC` skip-Flag analog `SKIP_PHASEA`) oder in einen eigenen Workflow auslagern. Erst umsetzen, falls 1.–3. nicht reichen.

5. **Validierung**
   - Workflow manuell triggern.
   - Erwartung: Lauf bleibt deutlich unter 25 min, phase1 + phaseC werden geschrieben, R2-Objekt `openmeteo/forecast.json` enthält 792 Punkte.
   - Frontend (`/karten/radar`) zeigt weiterhin die erweiterte Prognose-Abdeckung.

## Nicht betroffen

- `scripts/ingest_openmeteo.py`-Logik für phaseA (bleibt durch `SKIP_PHASEA=1` aus diesem Workflow ausgespart).
- `openmeteo-symbol.yml` (eigener Key `openmeteo/symbol.json`).
- Grid-Geometrie, BBOX, Cache-Format, Server-Funktionen, UI.
