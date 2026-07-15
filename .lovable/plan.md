## Diagnose

Auch mit `BATCH_SLEEP_S=30` schlägt Batch 6/11/16 wieder mit `429 Minutely API request limit` fehl. Ursache ist nicht die Netto-Rate (5×120 = 600 Calls in ~150 s ≈ 240/min ist eigentlich unter dem Limit), sondern **Retry-Overshoot**: sobald ein Batch retryt, sendet er die vollen 120 Locations erneut — bei 3 Retries plötzlich +360 Calls im gleitenden 60-s-Fenster. Das kippt die Nachbar-Batches ins 429.

Ergo: die Batchgrösse selbst ist zu grob. Eine kleinere Chunk-Grösse macht sowohl den Grund­verkehr feiner (weniger 429-Anfälligkeit) als auch Retries billiger (60 statt 120 zusätzliche Calls).

## Fix

Nur ENV in `.github/workflows/openmeteo-ingest.yml`:

```yaml
CHUNK_PHASE1: "60"    # war 120
BATCH_SLEEP_S: "20"   # war 30 — bei halber Batchgrösse wieder runter
```

Rechnung: 60 Calls / 22 s ≈ **164 Calls/min**, komfortabler Puffer auch bei Retry-Overshoot (+60 statt +120). 45 Batches × 22 s ≈ **16.5 min**, weit unter dem 60-min-Timeout.

`CHUNK_PHASEC=60`, `FETCH_WORKERS=1`, Grid-Größen, `PHASE1_DENSE_MAX_FAIL_PCT=20` bleiben. Kein Python-Change.

## Verifikation

Workflow manuell dispatchen, im Log prüfen:
1. Keine wiederkehrenden `429 Minutely API request limit`-WARN mehr (vereinzelte Read-Timeouts akzeptabel).
2. `write_forecast_manifest ok` erscheint.
3. `/api/public/debug/r2-cache`: `forecast.frameCount > 0`, `futureFrameCount > 0`, `ageSeconds < 900`.

## Nicht geändert

Python-Script, Grid-Größen, phaseC, Radar-/Symbol-Workflows, Client-Code.
