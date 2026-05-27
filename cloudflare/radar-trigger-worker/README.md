# Radar Trigger Worker

Externer Cloudflare-Worker, der alle 5 Minuten den Radar-Ingest-Endpoint der App
pingt. Damit ist der Ingest unabhängig vom unzuverlässigen GitHub-Actions-Cron.

## Architektur

```
Cloudflare Cron (*/5)  →  scheduled()  →  POST /api/public/radar/ingest-trigger
                                                  │
                                                  ▼
                                  GitHub workflow_dispatch → Radar Ingest läuft
```

## Einmaliger Setup

### 1. GitHub Fine-Grained PAT erstellen

1. https://github.com/settings/personal-access-tokens/new
2. **Repository access**: nur das Repo dieses Projekts
3. **Permissions → Repository → Actions**: **Read and write**
4. Token kopieren

### 2. Lovable-Cloud-Secrets setzen

Im Lovable-Projekt (über den Chat oder Cloud-Settings):

- `RADAR_TRIGGER_SECRET` — beliebiger zufälliger String, z.B. `openssl rand -hex 32`
- `GITHUB_DISPATCH_TOKEN` — der PAT aus Schritt 1
- `GITHUB_REPO` — `username/repo-name`
- `GITHUB_REF` *(optional)* — Default `main`

### 3. Worker deployen

Voraussetzung: Cloudflare-Account und installiertes `wrangler` CLI
(`npm i -g wrangler`, dann `wrangler login`).

```bash
cd cloudflare/radar-trigger-worker
wrangler deploy
wrangler secret put TRIGGER_URL
# z.B. https://symbolprognose.lovable.app/api/public/radar/ingest-trigger
wrangler secret put TRIGGER_SECRET
# exakt der gleiche Wert wie RADAR_TRIGGER_SECRET im Lovable-Projekt
```

### 4. Smoketest

```bash
curl -X POST https://symbolprognose.lovable.app/api/public/radar/ingest-trigger \
  -H "x-trigger-secret: <RADAR_TRIGGER_SECRET>"
```

Erwartete Antwort: `202 {"ok":true,"dispatchedAt":"…"}`.
GitHub Actions sollte innerhalb von 1–2 Sekunden einen neuen "Radar Ingest"-Run
mit Trigger-Typ **workflow_dispatch** zeigen.

## Throttle

Der Endpoint erlaubt max. 1 Dispatch pro 60 s pro Worker-Instanz (Schutz vor
versehentlichen Schleifen). Bei zu schnellem zweitem Call: `429 {throttled: true}`.
