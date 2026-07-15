## Diagnose

Trotz `BATCH_SLEEP_S=13` triggert Open-Meteo weiterhin `429 Minutely API request limit`. Muster im Log: **jeder 5.–6. Batch failed**. 5 Batches × 120 Punkte in ~65 s ≈ ~550 Calls/min — rechnerisch unter dem 600er-Limit, aber Open-Meteo misst in einem **gleitenden Minutenfenster**, und wenn ein Retry-Backoff (63 s) einen Batch ins nächste Fenster schiebt, überlappen die Zählungen und der nächste Batch schlägt sofort wieder auf.

Zusätzlich: die zwei folgenden `Read timed out`-Retries nach jedem 429 sind Symptom, nicht Ursache — Open-Meteo hält die Verbindung offen, antwortet aber nicht, solange das Ratelimit noch aktiv ist.

## Fix

Nur ENV in `.github/workflows/openmeteo-ingest.yml`:

```yaml
BATCH_SLEEP_S: "20"   # war 13
```

Rechnung: 120 pts alle ~22 s (Sleep 20 s + ~2 s Fetch) = ~2.7 Batches/min = **~325 Calls/min** — sattes Sicherheitsnetz unter 600, robust gegen gleitendes Fenster. 23 Batches × 22 s ≈ **8.5 min** Gesamtdauer, immer noch weit unter 60 min Workflow-Timeout.

`CHUNK_PHASE1=120`, `CHUNK_PHASEC=60`, `FETCH_WORKERS=1` bleiben. Kein Code-Change.

## Verifikation

Workflow manuell dispatchen, im Log prüfen:

1. Keine `429 Minutely API request limit`-WARN mehr (vereinzelte Read-Timeouts sind ok).
2. `write_forecast_manifest ok` erscheint.
3. `/api/public/debug/r2-cache`: `forecast.frameCount > 0`, `futureFrameCount > 0`, `ageSeconds < 900`.

Falls doch noch 429 durchrutschen: `BATCH_SLEEP_S=30` (dann ~13 min Gesamtdauer, immer noch unkritisch).

## Nicht geändert

Python-Script, Grid-Größen, phaseC, Radar-/Symbol-Workflows, Client-Code.
