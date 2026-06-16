## Open-Meteo Ingest: Job-Cancellation durch Cron-Überlappung beheben

### Diagnose

Der eigentliche Fehler im neuen Log ist **nicht** der Timeout — Batch 10 hatte 1 WARN, aber 8/9 liefen danach weiter. Der Abbruch kommt von GitHub selbst:

```
Error: The operation was canceled.
```

Ursache: In `.github/workflows/openmeteo-ingest.yml` steht

```yaml
concurrency:
  group: openmeteo-ingest
  cancel-in-progress: true
```

und der **Cloudflare-Cron-Worker triggert den Workflow alle 5 min** via `workflow_dispatch`. Mit den neuen Settings dauert phase1 jetzt deutlich länger:

- 80 Batches × (~1 s Request + 6 s Sleep) ≈ **9+ min** nur für phase1
- + phase2 (CH2 hourly) + phaseC (Lookback) → Gesamt ~12–15 min

Sobald der nächste 5-min-Cron eintrifft, killt `cancel-in-progress: true` den laufenden Job mitten in phase1. Daher der saubere "operation was canceled" direkt nach Batch 9.

Der Hinweis "read timeout=30.0" in Batch 10 ist sekundär: ein einzelner Slow-Response, der vom 7-stufigen Backoff sowieso aufgefangen worden wäre — nicht der Grund für den Abbruch.

### Edit 1 — Cron-Überlappung verhindern

`.github/workflows/openmeteo-ingest.yml`:

```yaml
concurrency:
  group: openmeteo-ingest
  cancel-in-progress: false   # war: true
```

Damit queued GitHub neue Trigger oder verwirft sie sauber, ohne den laufenden Job zu killen. Bei `workflow_dispatch` heisst das praktisch: max. 1 Folge-Run wartet, weitere werden zusammengefasst.

### Edit 2 — Laufzeit zurück unter 5 min bringen

`BATCH_SLEEP_S=6` war für den Fall gedacht, dass Open-Meteo bei Parallelität throttelt. Mit `FETCH_WORKERS=1` ist der Stream eh seriell — 6 s zusätzlich pro Batch sind übertrieben.

`.github/workflows/openmeteo-ingest.yml`, env-Block:

```yaml
CHUNK_PHASE1: "10"          # unverändert
BATCH_SLEEP_S: "2"          # war 6 — bei workers=1 reicht 2 s
OM_CONNECT_TIMEOUT: "30"    # unverändert
OM_READ_TIMEOUT: "300"      # unverändert
FETCH_WORKERS: "1"          # unverändert
```

Geschätzte phase1-Laufzeit: 80 × (1 s + 2 s) ≈ **4 min**, Gesamt-Job ~6–8 min — passt deutlich besser zwischen zwei 5-min-Cron-Trigger, und falls doch mal eng → `cancel-in-progress: false` puffert.

### Kein Code-Change

`scripts/ingest_openmeteo.py` (inkl. neu gepatchtem `BATCH_SLEEP_S`-Respekt aus letzter Runde) bleibt unverändert. Exponential-Backoff existiert bereits 7-stufig im `fetch()`.

### Verifikation

1. GitHub Actions → **Open-Meteo Cache Ingest** → **Run workflow** manuell.
2. Log läuft komplett durch: phase1 80/80 ok, phase2 ok, phaseC ok, `uploaded openmeteo/forecast.json`, `done`.
3. Kein "operation was canceled" mehr, selbst wenn parallel der Cloudflare-Cron tickert.
4. R2 `openmeteo/forecast.json` `generatedAt` frisch.

### Nicht im Scope

- `weather-widget.tsx` Quellenangaben — warten weiterhin auf grünen `mch/local_forecast.json`-Lauf.
- `phaseA` / Symbolprognose-Workflow.
