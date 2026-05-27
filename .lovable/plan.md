## Repo bestätigt
`oberthurgauerwetter2026/symbolprognose`

## Nächster Schritt: 3 Lovable Cloud Secrets anlegen

Nach Plan-Approval öffne ich das sichere Secret-Formular mit diesen 3 Feldern:

1. **`GITHUB_REPO`** → Wert: `oberthurgauerwetter2026/symbolprognose` (kannst du direkt eintragen)
2. **`GITHUB_DISPATCH_TOKEN`** → der GitHub PAT (`github_pat_…`), den du gerade erstellst
3. **`RADAR_TRIGGER_SECRET`** → ein Zufalls-String. Generiere lokal z. B. mit:
   ```bash
   openssl rand -hex 32
   ```
   oder nimm irgendeinen langen Zufallsstring (≥32 Zeichen). Diesen brauchst du später auch im Cloudflare Worker als gleichen Wert.

## Danach
- Endpoint `POST /api/public/radar/ingest-trigger` ist live und prüft den Header `x-trigger-secret` gegen `RADAR_TRIGGER_SECRET`.
- Bei Match löst er via `GITHUB_DISPATCH_TOKEN` einen `workflow_dispatch` auf das Repo `GITHUB_REPO` aus → GitHub Actions startet den Radar-Ingest.

## Optional als Folgeschritt
Cloudflare Worker deployen (Code liegt in `cloudflare/radar-trigger-worker/`) — oder als Alternative cron-job.org als externen Pinger nutzen, der den Endpoint mit dem Secret-Header alle X Minuten aufruft.

**Approve den Plan**, dann öffne ich das Secret-Formular.