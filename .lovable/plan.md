## Problem

Der Worker wird erfolgreich hochgeladen (`Uploaded symbolprognose-radar-cron`), aber das Deploy bricht ab, weil Cloudflare für das Konto keine workers.dev-Subdomain registriert hat und keine Route konfiguriert ist.

Der Cron-Worker braucht aber gar keinen öffentlich erreichbaren HTTP-Endpoint — er läuft nur per Cron-Trigger (`*/5 * * * *`) und ruft selbst die Lovable-API auf. Die `fetch()`-Handler im Code (`/status`, `/run`) sind nur optional zum manuellen Testen, aber dafür reicht es, sie aus dem Cloudflare-Dashboard heraus aufzurufen — keine öffentliche URL nötig.

## Fix

In `cron-worker/wrangler.toml` die Zeile `workers_dev = false` ergänzen. Damit überspringt Wrangler die workers.dev-Veröffentlichung; Upload + Cron-Trigger bleiben aktiv.

**Datei:** `cron-worker/wrangler.toml`

```toml
name = "symbolprognose-radar-cron"
account_id = "7399d9323a9b244c0e4f5352c9cd8ead"
main = "src/index.ts"
compatibility_date = "2025-09-24"
workers_dev = false

[triggers]
crons = ["*/5 * * * *"]

[vars]
TARGET_URL = "https://symbolprognose.lovable.app/api/public/radar/ingest-trigger"
EPS_TARGET_URL = "https://symbolprognose.lovable.app/api/public/eps/ingest-trigger"

[observability]
enabled = true
```

## Verifikation

Nach Commit auf `main`:
1. GitHub → Actions → "Deploy cron-worker" → Run grün, Log endet mit `Uploaded symbolprognose-radar-cron` ohne den workers.dev-Fehler.
2. Cloudflare → Workers & Pages → `symbolprognose-radar-cron` → in den Live-Logs erscheint innerhalb 5 Min `[cron:radar] … → 202` und `[cron:eps] … → 202`.

## Alternative (falls die /status- und /run-Endpoints öffentlich erreichbar bleiben sollen)

Stattdessen einmalig im Cloudflare-Dashboard die Subdomain registrieren:
https://dash.cloudflare.com/7399d9323a9b244c0e4f5352c9cd8ead/workers/onboarding
→ z. B. `dein-name.workers.dev` wählen, dann `workers_dev = true` setzen (oder weglassen, ist Default). Für den reinen Cron-Betrieb aber unnötig.