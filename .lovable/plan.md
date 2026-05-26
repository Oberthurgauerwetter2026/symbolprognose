Open-Meteo Ingest gegen 429 (Minutenlimit) härten. Keine Logik-/Datenänderung, nur Pacing & Backoff.

## Änderungen in `scripts/ingest_openmeteo.py`

**1. Backoffs für 429 auf volle Minuten anheben** (`fetch`, Zeile ~78)
- Aktuell: `[3, 10, 30, 60, 120]` Sekunden
- Neu: bei `429` direkt **65 s** warten (Minutenfenster + Puffer), bei sonstigen Fehlern weiterhin progressiv. Konkret: zwei Backoff-Listen führen — `BACKOFF_429 = [65, 65, 70, 90, 120]`, `BACKOFF_OTHER = [3, 10, 30, 60, 120]` — und in `fetch` je nach `last_err`-Typ wählen.

**2. Inter-Batch-Pause erhöhen** (`chunk_fetch`, Zeile 135)
- Aktuell: `time.sleep(0.5)` zwischen Batches
- Neu: konfigurierbar via Env `BATCH_SLEEP_S` (Default `6.0`). 10 Batches × 6 s = ~60 s Spread → bleibt sicher unter dem Minutenlimit.

**3. Optional: Chunk-Größe etwas senken**
- `CHUNK_PHASEA` Default von `25` auf `20` setzen (mehr, dafür kleinere Requests sind freundlicher zum Upstream).

## Nicht verändert

- Phase1/PhaseC-Cache-Übernahme, R2-Upload, JSON-Schema, Fallback-Pfad bei komplettem PhaseA-Fail.
- Workflow `.github/workflows/openmeteo-ingest.yml` bleibt unverändert (Werte überschreibbar via Env, falls später nötig).

## Erwartetes Verhalten

- Jeder Lauf: ~10 Batches × ~6 s = 60–90 s Gesamtdauer für PhaseA bei Idealfall.
- Bei 429 wartet der Worker eine ganze Minute → Open-Meteo-Limit reset → nächster Versuch klappt fast immer beim ersten Retry, statt 4–5 Retries zu verbrennen.
- Kein Action-Cancel mehr durch endlose Backoff-Eskalation.