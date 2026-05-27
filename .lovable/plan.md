## Ziel

Externer Cloudflare Worker pingt alle 5 Minuten den bestehenden Endpoint `/api/public/radar/ingest-trigger`, damit der Radar-Ingest zuverlässig läuft (nicht mehr abhängig von GitHub Actions `schedule:`, das oft verspätet/ausgelassen wird).

GitHub Actions `schedule:` bleibt unverändert als Sicherheitsnetz – die `MIN_INTERVAL_MS = 60_000`-Throttle in `dispatchRadarIngest` verhindert Doppel-Runs.

## Was angelegt wird

Neuer Ordner `cron-worker/` (komplett separat von der Lovable-App, kein Einfluss auf den Build):

```
cron-worker/
├── wrangler.toml        # name, main, cron, vars
├── package.json         # nur wrangler als devDep
├── tsconfig.json
└── src/index.ts         # scheduled() + fetch() Handler
```

### `cron-worker/wrangler.toml`
- `name = "symbolprognose-radar-cron"`
- `main = "src/index.ts"`
- `compatibility_date = "2025-09-24"`
- `[triggers] crons = ["*/5 * * * *"]`
- `[vars] TARGET_URL = "https://symbolprognose.lovable.app/api/public/radar/ingest-trigger"`
- Secret `RADAR_TRIGGER_SECRET` wird per `wrangler secret put` gesetzt (nicht im File)

### `cron-worker/src/index.ts`
- `scheduled(event, env, ctx)`:
  - `POST` an `env.TARGET_URL` mit Header `x-trigger-secret: env.RADAR_TRIGGER_SECRET`
  - Loggt Status + Response-Snippet (sichtbar in `wrangler tail`)
  - Bei non-2xx & nicht 429 (throttle) → `console.error` für spätere Alerts
- `fetch()` Handler:
  - `GET /` → kleiner Status: "ok, last cron at …" (nice-to-have, kein State persistiert)
  - Sonst 404

## Deploy-Schritte (du, im Mac-Terminal)

```
cd ~/<projekt-ordner>/cron-worker
npm install
wrangler deploy
wrangler secret put RADAR_TRIGGER_SECRET
# → Wert eingeben (selber Wert wie in Lovable Cloud Runtime-Secret)
wrangler tail            # zum Live-Mitschauen, optional
```

Ich liefere dir die genauen Befehle nochmals direkt nach dem Erstellen der Files.

## Verifikation

1. Nach `wrangler deploy` 5–10 Min warten, dann `wrangler tail` → muss alle 5 Min einen `202 Accepted` von Lovable zeigen.
2. In Lovable Worker-Logs: `[radar]` Manifest-Einträge sollten ab dem Zeitpunkt einen frischen `t`-Wert ≤ 10 Min alt haben.
3. UI-Check `/karten/radar`: Animation deckt die letzten ~6h lückenlos ab.

## Nicht im Plan (bewusst weggelassen)

- GitHub-Actions `schedule:` anfassen – bleibt als Backup.
- Heartbeat-Anzeige in UI – kann später als separater Schritt nachgezogen werden, wenn der Worker stabil läuft.
- Discord/E-Mail-Alert – später bei Bedarf.

## Voraussetzungen / Annahmen

- Du hast ein Cloudflare-Konto und bist via `wrangler login` eingeloggt (✓ bereits erledigt).
- Runtime-Secret `RADAR_TRIGGER_SECRET` existiert bereits in Lovable Cloud – du kennst den Wert oder kannst ihn neu setzen (in dem Fall muss er an beiden Stellen identisch sein).
- Der Endpoint `https://symbolprognose.lovable.app/api/public/radar/ingest-trigger` ist die korrekte Produktions-URL.
