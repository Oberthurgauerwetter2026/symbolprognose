## Ziel

Doppelte Trigger entfernen, damit jeder Ingest nur noch vom Cloudflare Worker (alle 5 min) gestartet wird — keine parallelen GitHub `schedule:`-Läufe mehr, weniger Open-Meteo / MCH Last, einfachere Fehlersuche.

## Änderungen

### 1. `.github/workflows/radar-ingest.yml`
- `schedule:` Block (`*/15 * * * *`) entfernen.
- `on:` enthält nur noch `workflow_dispatch: {}`.
- Kommentar oben aktualisieren: Trigger ausschliesslich via Cloudflare Worker (`cron-worker/`) alle 5 min.

### 2. `.github/workflows/icon-eps-ingest.yml`
- `schedule:` Block (`*/30 * * * *`) entfernen.
- `on:` enthält nur noch `workflow_dispatch: {}`.
- Kommentar ergänzen: Trigger via Cloudflare Worker (`cron-worker/`) alle 5 min; Script no-opt wenn neuester Run schon in R2.

### 3. Keine Änderungen an
- `openmeteo-ingest.yml` / `openmeteo-symbol.yml` (haben bereits nur `workflow_dispatch`).
- `cron-worker/` (triggert weiterhin alle 4 Workflows).
- Ingest-Scripts selbst.

## Resultat

| Workflow | Trigger vorher | Trigger nachher |
|---|---|---|
| radar-ingest | Worker 5 min + GitHub 15 min | Worker 5 min |
| icon-eps-ingest | Worker 5 min + GitHub 30 min | Worker 5 min |
| openmeteo-ingest | Worker 5 min | Worker 5 min (unverändert) |
| openmeteo-symbol | Worker 4×/Tag | Worker 4×/Tag (unverändert) |

## Risiko / Rollback

Fällt der Cloudflare Worker aus, läuft kein Ingest mehr automatisch. Rollback = `schedule:` Blöcke wieder einfügen (1 Commit). Worker-Health ist in Cloudflare Observability sichtbar; bei längerem Ausfall manuell `workflow_dispatch` triggern.