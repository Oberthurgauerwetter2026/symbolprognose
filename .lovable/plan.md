# Externer Cloudflare-Trigger für Radar-Ingest (Option b)

Zusätzlich zum bestehenden GitHub-Cron baue ich einen externen Trigger, der den Radar-Ingest wirklich alle 5 Minuten anstößt — unabhängig vom GitHub-Actions-Scheduler-Jitter.

## Architektur

```text
Cloudflare Worker Cron (*/5)
        │  fetch
        ▼
project--…lovable.app/api/public/radar/ingest-trigger
        │  POST mit Shared-Secret-Header
        ▼
GitHub API: workflow_dispatch  →  Radar Ingest Workflow läuft
```

Der bestehende GitHub-Doppel-Cron bleibt als Fallback aktiv. Wenn der externe Trigger ausfällt, läuft der Ingest trotzdem.

## Was ich baue

### 1. Neuer Endpoint `src/routes/api/public/radar/ingest-trigger.ts`

- `POST` + `OPTIONS` (CORS).
- Prüft Header `x-trigger-secret` gegen das Cloud-Secret `RADAR_TRIGGER_SECRET` (timing-safe compare).
- Bei Erfolg: `POST https://api.github.com/repos/{owner}/{repo}/actions/workflows/radar-ingest.yml/dispatches` mit `Authorization: Bearer {GITHUB_DISPATCH_TOKEN}` und Body `{ "ref": "main" }`.
- Antwortet `202 { ok: true, dispatched_at }` oder `4xx/5xx` mit Fehlertext.
- Rate-Limit-Safety: zusätzlich ein simpler In-Memory-Throttle (max. 1 Dispatch alle 60s), damit eine Schleife nicht versehentlich GitHub-API-Limits sprengt.

### 2. Cloudflare Worker `cloudflare/radar-trigger-worker/`

Kleines eigenes Worker-Projekt (separater `wrangler.toml`, separates Deploy — nicht Teil des Haupt-App-Builds):

```text
cloudflare/radar-trigger-worker/
├── wrangler.toml        # cron: "*/5 * * * *"
├── src/index.ts         # scheduled() handler → fetch trigger endpoint
└── README.md            # Deploy-Anleitung
```

`scheduled()` ruft den Trigger-Endpoint mit `x-trigger-secret` auf. Loggt Status. Der Worker muss vom Nutzer einmal manuell mit `wrangler deploy` ausgerollt werden (Cloudflare-Account erforderlich) — ich liefere die Anleitung im README.

### 3. Secrets

Drei neue Secrets via Lovable Cloud:
- `RADAR_TRIGGER_SECRET` — Shared Secret zwischen Worker und Endpoint (ich generiere einen Vorschlag).
- `GITHUB_DISPATCH_TOKEN` — GitHub Fine-Grained PAT mit Scope `Actions: Read and write` für genau dieses Repo.
- `GITHUB_REPO` — z.B. `username/repo-name`, damit der Endpoint die richtige URL bildet.

Der Worker bekommt `RADAR_TRIGGER_SECRET` und die Ziel-URL als eigene Wrangler-Secrets (vom Nutzer gesetzt).

## Was sich NICHT ändert

- `scripts/ingest_radar.py` bleibt wie im letzten Schritt (v7-resilient).
- GitHub-Workflow-Cron bleibt aktiv als Backup.
- Frontend, Map, R2-Struktur unverändert.

## Was der Nutzer einmalig tun muss

1. GitHub Fine-Grained PAT erstellen (Anleitung im README).
2. `GITHUB_REPO`, `GITHUB_DISPATCH_TOKEN`, `RADAR_TRIGGER_SECRET` in Lovable Cloud setzen (ich frage danach, sobald der Code steht).
3. Cloudflare Worker mit `wrangler deploy` ausrollen und dort `TRIGGER_SECRET` + `TRIGGER_URL` als Worker-Secrets setzen.

## Frage

Soll ich die Lovable-Cloud-Secrets jetzt schon mit `add_secret` anlegen (du bekommst dann das Eingabefenster), oder erst nachdem der Code committed ist?
