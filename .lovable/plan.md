## Open-Meteo Ingest: Queue-Cancel durch zu enge Cron-Frequenz vermeiden

### Ursache

`cancel-in-progress: false` lässt **genau 1** Run warten. Ein dritter Trigger killt den wartenden mit der Meldung „higher priority waiting request". Der Cron-Worker triggert `openmeteo` alle 10 min, der Job läuft aktuell ~8–12 min → 3 Runs überlappen sich regelmässig.

Zwei Hebel gleichzeitig: **Trigger entzerren** + **Laufzeit kürzen**, beides mit Sicherheitsmarge gegen Open-Meteo-429.

### Edit 1 — Cron-Worker: Open-Meteo nur alle 15 min

`cron-worker/src/index.ts` (Zeile 147):

```ts
const includeOpenmeteo = minute % 15 === 0;   // war: minute % 10 === 0
```

→ 96 Trigger/Tag statt 144. Open-Meteo-Daten sind ohnehin Modell-stündlich, 15 min Cache-Alter ist für die Wetter-Widgets unkritisch.

Anschliessend `cron-worker-deploy.yml` durchlaufen lassen (Push auf main reicht).

### Edit 2 — Ingest-Laufzeit zuverlässig unter 6 min

`.github/workflows/openmeteo-ingest.yml`, env-Block:

```yaml
CHUNK_PHASE1: "15"     # zurück auf 15 (war 10) — 53 batches statt 80
BATCH_SLEEP_S: "1"     # war 2 — bei workers=1 reicht 1 s
CHUNK_PHASEC: "60"     # unverändert
OM_CONNECT_TIMEOUT: "30"
OM_READ_TIMEOUT: "300"
FETCH_WORKERS: "1"     # unverändert (kein Parallel-Druck auf Open-Meteo)
```

Geschätzte phase1-Laufzeit: 53 × (1.2 s + 1 s) ≈ **2 min**, Gesamt-Job inkl. phase2 + phaseC ≈ **5–6 min**. Selbst bei einem slow-Batch mit Retry bleibt Puffer zu 15 min.

Begründung für `CHUNK_PHASE1=15` trotz vorheriger 429-Sorge: Der eigentliche WARN damals war ein **Read-Timeout**, kein 429. Mit `FETCH_WORKERS=1` ist die Request-Rate Richtung Open-Meteo identisch zu `CHUNK=10` — nur die Payload pro Request wächst. Open-Meteo schickt 15 Punkte problemlos in einer Antwort (Limit liegt deutlich höher).

### Edit 3 — Kein Code-Change am Python-Script

`scripts/ingest_openmeteo.py` bleibt unverändert. Der 7-stufige Backoff fängt Einzel-Timeouts ab; `BATCH_SLEEP_S`-Respekt aus der vorherigen Runde bleibt aktiv.

### Verifikation

1. Cron-Worker-Deploy abwarten (GitHub Actions → `cron-worker-deploy`).
2. `openmeteo-ingest` manuell triggern, Log: phase1 53/53 ok, phase2 ok, phaseC ok, `uploaded openmeteo/forecast.json`, Gesamtlaufzeit < 6 min.
3. 30 min beobachten: keine „higher priority waiting request"-Cancels mehr, `lastOpenmeteo.at` im Worker-`/status` aktualisiert sich alle 15 min.
4. R2 `openmeteo/forecast.json` `generatedAt` max. 15 min alt.

### Nicht im Scope

- `weather-widget.tsx` Quellenangaben.
- `phaseA` / Symbol-Workflow (eigener Takt, eigener Workflow).
- Wechsel auf `FETCH_WORKERS>1` — erst dann nötig, wenn Open-Meteo-Punkte deutlich wachsen.
