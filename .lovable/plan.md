## Open-Meteo Ingest: phase1 weiter stabilisieren

Der Log zeigt: mit `CHUNK_PHASE1=15` / `OM_READ_TIMEOUT=300` / `FETCH_WORKERS=1` laufen Batches 1–13 sauber durch, ab Batch 14 fängt Open-Meteo wieder an zu warnen. Der Hauptlauf ist also deutlich besser, aber Open-Meteo throttelt unsere IP nach ~13 Batches in Folge.

Da der Durchsatz vorher kein Problem war (53 Batches × ~1 s passen locker in 45 min Timeout), drosseln wir gezielt weiter — kleiner und langsamer.

### Edit

Nur `.github/workflows/openmeteo-ingest.yml`, env-Block:

```yaml
CHUNK_PHASE1: "10"        # war 15 — weniger Payload pro Request
CHUNK_PHASEC: "60"        # unverändert
BATCH_SLEEP_S: "6"        # war 3 — doppelte Pause zwischen Batches
OM_CONNECT_TIMEOUT: "30"  # unverändert
OM_READ_TIMEOUT: "300"    # unverändert
FETCH_WORKERS: "1"        # unverändert
```

Hinweis: `BATCH_SLEEP_S` wird im aktuellen `scripts/ingest_openmeteo.py` nicht direkt zwischen Batches gerespektet (Threadpool feuert parallel). Bei `FETCH_WORKERS=1` ist das Verhalten effektiv seriell, aber ohne Sleep dazwischen. Falls die ENV-Änderung allein nicht reicht, kommt im zweiten Schritt ein kleiner Code-Patch in `chunk_fetch`: nach jedem `fut.result()` ein `time.sleep(int(os.environ.get("BATCH_SLEEP_S","0")))`, damit die Pause real wirkt.

### Kein Risiko für andere Pfade

- `scripts/ingest_mch_local_forecast.py` und `openmeteo-symbol.yml` bleiben unberührt.
- UI-Quellenangaben in `weather-widget.tsx` warten weiterhin auf grünen `mch/local_forecast.json`-Lauf.

### Verifikation

1. GitHub Actions → **Open-Meteo Cache Ingest** → **Run workflow**.
2. Log: erwartet ≤ 1–2 vereinzelte WARNs, kein endgültiger Fail; ~79 statt 53 Batches.
3. R2 `openmeteo/forecast.json` hat frisches `generatedAt`.
4. Falls weiterhin > 5 WARNs/Run → zweiter Schritt: `chunk_fetch`-Patch für echtes `BATCH_SLEEP_S`.

### Nicht im Scope

- `weather-widget.tsx` Quellenangaben (kommt nach grünem MCH-local-forecast-Run).
- phaseA / Symbolprognose (eigener Workflow, separater Schedule).
