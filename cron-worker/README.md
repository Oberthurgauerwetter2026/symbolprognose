# symbolprognose-radar-cron

Cloudflare Worker mit 5-Min-Cron, der den Radar-Ingest auf
`symbolprognose.lovable.app` zuverlässig anstösst (GitHub-Actions-`schedule:`
bleibt als Backup parallel laufen — Doppel-Runs werden serverseitig per
60-s-Throttle verhindert).

## Erst-Deploy

Im Terminal (Mac), aus diesem Ordner:

```bash
cd cron-worker
npm install
npx wrangler deploy
npx wrangler secret put RADAR_TRIGGER_SECRET
# → Wert eingeben (identisch zum Lovable-Cloud-Secret RADAR_TRIGGER_SECRET)
```

## Live-Logs

```bash
npx wrangler tail
```

Erwartung: alle 5 Min eine Zeile `[cron] … → 202 dispatched: …`.

## Status / manueller Trigger

Nach dem Deploy zeigt Cloudflare die Worker-URL an, z.B.
`https://symbolprognose-radar-cron.<account>.workers.dev`.

- `GET  /`        → JSON mit letztem Run
- `POST /run`     → manueller Sofort-Trigger (für Tests)

## Cron ändern

`wrangler.toml` → `[triggers] crons = [...]` anpassen, dann `npx wrangler deploy`.
