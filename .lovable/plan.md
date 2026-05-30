## Problem

Der GitHub-Schedule für `openmeteo-symbol.yml` (Symbolprognose, 4×/Tag) ist seit gestern 23:19 MESZ ausgesetzt — GitHub verwirft `schedule:`-Trigger bei Last ohne Warnung. Resultat: Die Symbolprognose im UI endet bei Sonntag 11 Uhr (Horizont vom letzten 20-UTC-Lauf).

Radar (alle 5 min) und ICON-EPS (alle 30 min) werden bereits zuverlässig vom Cloudflare-Cron-Worker `symbolprognose-radar-cron` per `workflow_dispatch` getriggert. Wir erweitern den Worker analog um die Symbolprognose.

## Änderungen

### 1. Neuer HTTP-Endpoint in Lovable

`src/routes/api/public/symbol/ingest-trigger.ts` (analog zu `radar/ingest-trigger.ts` und `eps/ingest-trigger.ts`):
- Prüft `x-trigger-secret`-Header gegen `RADAR_TRIGGER_SECRET` (gleiches Secret wiederverwenden — ein Secret für alle drei Trigger).
- Ruft neuen Helper `dispatchSymbolIngest()` auf.

### 2. Neuer Dispatch-Helper

`src/lib/symbol-dispatch.server.ts` (Kopie von `eps-dispatch.server.ts`):
- Throttle: 30 min (Symbolprognose ändert sich frühestens 4×/Tag).
- Triggert Workflow-File `openmeteo-symbol.yml`.

### 3. Cloudflare-Worker erweitern

`cron-worker/src/index.ts`:
- Zusätzlicher Cron-Trigger `0 2,8,14,20 * * *` (UTC, gleich wie bisheriger GitHub-Schedule, ~2 h nach den Modellläufen).
- Bei jedem Tick zusätzlich `POST /api/public/symbol/ingest-trigger` an `symbolprognose.lovable.app` mit `x-trigger-secret`-Header.
- Bestehende `*/5`-Cron-Logik (radar+eps) bleibt unverändert.

`cron-worker/wrangler.toml`:
- `crons` um den 6-Stunden-Trigger erweitern → `crons = ["*/5 * * * *", "0 2,8,14,20 * * *"]`.

### 4. GitHub-Schedule entfernen

`.github/workflows/openmeteo-symbol.yml`:
- `schedule:`-Block entfernen, nur noch `workflow_dispatch: {}` lassen. Verhindert doppelte Läufe und macht den Cloudflare-Worker zur einzigen Trigger-Quelle. (Analog ist auch sinnvoll für `radar-ingest.yml` und `icon-eps-ingest.yml`, falls noch nicht geschehen — bestätigen wir vor Implementierung.)

### 5. Nach Deploy: einmalig manuell triggern

Damit die Prognose sofort wieder bis Mittwoch reicht (statt auf den nächsten 14-UTC-Slot zu warten), Workflow einmal manuell via GitHub "Run workflow" anstossen — oder durch einmaliges `POST /run` am Worker.

## Verifikation

- Cloudflare-Worker-Logs: alle 6 h zusätzlich `[cron:symbol] … → 202 dispatched`.
- GitHub Actions: Workflow läuft pünktlich 02/08/14/20 UTC.
- UI: Symbolprognose reicht wieder mehrere Tage in die Zukunft.

## Offene Frage

Soll ich auch den `schedule:`-Block in `radar-ingest.yml` und `icon-eps-ingest.yml` entfernen? Du hattest sie ursprünglich als Backup parallel laufen lassen, aber jetzt wo der Worker stabil läuft, vermeidet das doppelte Runs und API-Last.