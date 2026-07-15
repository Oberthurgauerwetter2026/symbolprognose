## Diagnose

Auch mit `BATCH_SLEEP_S=20` triggert Open-Meteo weiterhin `429 Minutely API request limit` — exakt bei Batch 6, 11, 16 (jeder 5. Batch). Muster: **5 Batches × 120 pts = 600 Calls** landen im gleitenden 60-s-Fenster von Open-Meteo. Bei 22 s Abstand ist Batch 6 nach ~110 s dran, aber die 429-Zählung überlappt aus dem vorherigen Fenster.

Der im letzten Plan bereits vorgesehene Fallback greift jetzt.

## Fix

Nur ENV in `.github/workflows/openmeteo-ingest.yml`:

```yaml
BATCH_SLEEP_S: "30"   # war 20
```

Rechnung: 120 pts alle ~32 s = **~225 Calls/min** — solider Puffer, auch bei Retry-Backoff-Überlappung. 23 Batches × 32 s ≈ **12.3 min** Gesamtdauer, weit unter 60 min Workflow-Timeout.

`CHUNK_PHASE1=120`, `CHUNK_PHASEC=60`, `FETCH_WORKERS=1` bleiben. Kein Code-Change.

## Verifikation

Workflow manuell dispatchen, im Log prüfen:
1. Keine `429 Minutely API request limit`-WARN mehr (vereinzelte Read-Timeouts sind ok, das ist Netz).
2. `write_forecast_manifest ok` erscheint.
3. `/api/public/debug/r2-cache`: `forecast.frameCount > 0`, `futureFrameCount > 0`, `ageSeconds < 900`.

## Nicht geändert

Python-Script, Grid-Größen, phaseC, Radar-/Symbol-Workflows, Client-Code.
