## Problem

Die Radar-Animation auf `/karten/radar` endet aktuell bei Sonntag 11 Uhr (≈ +24 h), obwohl der Code in `src/lib/radar.functions.ts` (Z. 241) bis zu +120 h erlaubt. Ursache: der Open-Meteo-Cache `phase1` (Quelle für ICON-CH1 minutely_15, normal +33 h) wird vom Workflow `openmeteo-ingest.yml` befüllt, der **nur** am GitHub-`schedule:`-Trigger hängt. GitHub verwirft diesen Trigger regelmässig (gleiche Pathologie wie heute Nacht bei `openmeteo-symbol`). Ergebnis: die Cache-Datei ist mehrere Stunden alt, der minutely_15-Horizont rutscht entsprechend zurück.

Die schon im letzten Schritt umgesetzte Worker-Erweiterung für `openmeteo-symbol` ist gut und bleibt — sie löst das verwandte Problem mit der Symbolprognose, nicht aber die Radar-Zeitleiste.

## Änderungen — gleiches Muster wie für eps/symbol

### 1. Neuer HTTP-Endpoint in Lovable

`src/routes/api/public/openmeteo/ingest-trigger.ts` (Copy-Edit von `symbol/ingest-trigger.ts`):
- Header-Check `x-trigger-secret` gegen `RADAR_TRIGGER_SECRET` (wieder gleiches Secret).
- Ruft neuen Helper `dispatchOpenmeteoIngest()`.

### 2. Neuer Dispatch-Helper

`src/lib/openmeteo-dispatch.server.ts`:
- Triggert Workflow-File `openmeteo-ingest.yml`.
- Throttle **60 s** (gleich wie Radar — Workflow läuft alle 5 min, kurzer Schutz reicht).

### 3. Cloudflare-Worker erweitern

`cron-worker/src/index.ts`:
- Im bestehenden `*/5`-Tick zusätzlich `/api/public/openmeteo/ingest-trigger` aufrufen (drittes Parallel-Target neben radar + eps).
- Neuer `RunRecord lastOpenmeteo` für `/status`.
- Neuer Debug-Endpoint `POST /run/openmeteo`.

`cron-worker/wrangler.toml`:
- Neue var `OPENMETEO_TARGET_URL = "https://symbolprognose.lovable.app/api/public/openmeteo/ingest-trigger"`.
- Crons bleiben unverändert (`*/5`, `0 2,8,14,20`).

### 4. GitHub-Schedule entfernen

`.github/workflows/openmeteo-ingest.yml`:
- `schedule:`-Block entfernen, nur `workflow_dispatch: {}` lassen. Worker wird einzige Trigger-Quelle.

## Nach Deploy

Damit der Radar-Forecast **sofort** wieder bis +33 h reicht (statt auf den nächsten erfolgreichen ingest zu warten): `POST` auf den Worker-Endpoint `/run/openmeteo` (oder im GitHub-UI "Run workflow" auf `openmeteo-ingest.yml`). In ~3–5 min ist die R2-Cache-Datei `openmeteo/forecast.json` neu, und die Zeitleiste reicht wieder weit in die Zukunft.

## Verifikation

- Cloudflare-Worker-Logs zeigen alle 5 min zusätzlich `[cron:openmeteo] … → 202 dispatched`.
- GitHub Actions: `openmeteo-ingest` läuft pünktlich alle 5 min als `workflow_dispatch`.
- UI: Radar-Zeitleiste reicht wieder mehrere Tage in die Zukunft (bis +120 h, wenn EPS frisch; sonst +33 h aus ICON-CH1).

## Offene Frage

Soll ich beim Aufräumen auch die `schedule:`-Blöcke in `radar-ingest.yml` und `icon-eps-ingest.yml` entfernen (Worker ist dort ohnehin der primäre Trigger)? Sie laufen aktuell als Backup parallel — was bei 5-Min-Cron doppelte API-Calls bedeutet.