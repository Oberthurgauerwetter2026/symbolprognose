## Ziel

Der Lovable-Managed-Worker übernimmt `triggers.crons` aus `wrangler.jsonc` offenbar nicht — GitHub zeigt nur manuelle Runs, keine `workflow_dispatch` vom Cron. Lösung: den bereits vorbereiteten **eigenen** Cloudflare Worker unter `cloudflare/radar-trigger-worker/` in deinem eigenen CF-Account deployen. Der Worker pingt alle 5 min den HTTP-Endpoint `/api/public/radar/ingest-trigger`, der wiederum `workflow_dispatch` auslöst.

## Was du selbst tun musst (manuelle Schritte)

Diese Schritte kann Lovable nicht für dich ausführen — sie brauchen deinen Cloudflare-Account.

### 1. Cloudflare-Account + wrangler CLI

- Falls noch nicht vorhanden: Account auf cloudflare.com anlegen (free tier reicht, Cron Triggers sind inkludiert).
- Lokal in einem Terminal:
  ```
  npm i -g wrangler
  wrangler login
  ```

### 2. Worker deployen

Repo lokal auschecken (oder direkt aus Lovable's GitHub-Mirror klonen), dann:
```
cd cloudflare/radar-trigger-worker
wrangler deploy
```
`wrangler.toml` mit `crons = ["*/5 * * * *"]` ist bereits committet.

### 3. Worker-Secrets setzen

```
wrangler secret put TRIGGER_URL
# Wert: https://symbolprognose.lovable.app/api/public/radar/ingest-trigger

wrangler secret put TRIGGER_SECRET
# Wert: exakt der gleiche String wie RADAR_TRIGGER_SECRET in Lovable Cloud
```

Den aktuellen `RADAR_TRIGGER_SECRET`-Wert findest du in Lovable → Project Settings → Secrets.

### 4. Smoketest

```
curl -X POST https://symbolprognose.lovable.app/api/public/radar/ingest-trigger \
  -H "x-trigger-secret: <RADAR_TRIGGER_SECRET>"
```
Erwartet: `202 {"ok":true,...}`. Innerhalb 1–2 s erscheint ein neuer GitHub-Actions-Run mit Trigger **workflow_dispatch**.

### 5. Verifikation nach 10 min

- Cloudflare Dashboard → Workers → `radar-trigger` → Logs: alle 5 min Eintrag `trigger status=202`.
- GitHub Actions → "Radar Ingest": alle 5 min neuer Run, Trigger = `workflow_dispatch`.

## Was Lovable im Code aufräumt

Da der Lovable-Worker-Cron nicht greift und der externe Worker übernimmt, sollten wir die nicht-funktionierende Konfiguration entfernen, damit es nicht so aussieht als würde da etwas laufen:

1. **`wrangler.jsonc`** — `"triggers": { "crons": [...] }` entfernen (greift bei Lovable-Managed-Deploy nicht).
2. **`src/server.ts`** — `scheduled()`-Handler entfernen (wird nie aufgerufen).
3. **`src/lib/radar-dispatch.server.ts`** — bleibt wie es ist, wird weiter vom HTTP-Endpoint genutzt.
4. **`src/routes/api/public/radar/ingest-trigger.ts`** — bleibt unverändert (= das, was der externe Worker pingt).
5. **`.github/workflows/radar-ingest.yml`** — Backup-Cron auf `*/15 * * * *` erhöhen (von `*/30`), als Sicherheitsnetz falls der externe Worker mal ausfällt. `workflow_dispatch` bleibt.
6. **`cloudflare/radar-trigger-worker/README.md`** — kurz aktualisieren: klarstellen, dass dieser Worker jetzt der **primäre** Trigger ist (nicht mehr nur Backup).

## Architektur danach

```text
Eigener Cloudflare Worker (Cron */5)
        │ POST x-trigger-secret
        ▼
/api/public/radar/ingest-trigger  (Lovable App)
        │ GitHub workflow_dispatch
        ▼
GitHub Actions "Radar Ingest"  →  R2  →  /karten/radar

Backup: GitHub schedule */15  (falls Worker mal stillsteht)
```

## Out of scope

- Eigene `RADAR_TRIGGER_SECRET`-Rotation
- Monitoring/Alerts (kann später ergänzt werden, z. B. healthcheck-Endpoint)
