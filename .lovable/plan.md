## Diagnose

Open-Meteo zählt jeden Location-Punkt als 1 API-Call. Bei `CHUNK_PHASE1=150` und `FETCH_WORKERS=1` verbraucht der Ingest **150 Calls/Batch**. Nach 4 Batches (~600 Calls) in <1 min triggert das Minuten-Limit (`HTTP 429 Minutely API request limit exceeded`). Log zeigt exakt dieses Muster: Batch 1–4 ok, Batch 5 → 429, Backoff ~140 s. Batch 5–8 ok, Batch 9 → 429 wieder. Der Run läuft dadurch immer noch ~15–20 min statt <5 min.

Der eigentliche Fehler im letzten Fix: `BATCH_SLEEP_S=0`. Ohne Pause zwischen Batches gibt es kein Rate-Limiting-Sicherheitsnetz — nur die Retries fangen es ab, teuer und langsam.

## Fix

Nur ENV-Werte in `.github/workflows/openmeteo-ingest.yml` justieren. Kein Code-Change.

```yaml
CHUNK_PHASE1: "120"       # war 150 → 5 Batches/min statt 4
BATCH_SLEEP_S: "13"       # war 0 → 120 pts × ~4.6 Batches/min ≈ 550 Calls/min
```

Rechnung: 2688 Punkte ÷ 120 = **23 Batches**. Bei 13 s Sleep + ~2 s Fetch = ~15 s/Batch → ~5.75 min Gesamtdauer, sauber unter 60 min Timeout und unter dem 600-Calls/min-Limit (Puffer ~50 Calls).

`phaseC` (60er-Chunks, Sparse) läuft danach in wenigen Sekunden durch, weil das Minuten-Budget nicht mehr blockiert ist.

## Verifikation

Nach Merge Workflow manuell dispatchen und Log prüfen:

1. Keine `429 Minutely API request limit` mehr.
2. `write_forecast_manifest ok` erscheint.
3. `/api/public/debug/r2-cache`: `forecast.frameCount > 0`, `futureFrameCount > 0`, `ageSeconds < 600`.

Falls trotzdem noch vereinzelt 429 auftauchen: `BATCH_SLEEP_S` auf `18` erhöhen (dann ~4 Batches/min, ~480 Calls/min).

## Nicht geändert

- Python-Ingest-Script, Grid-Größen (48×56 bleibt), Sparse-Fallback, Radar/Symbol-Workflows, Client-Code.
