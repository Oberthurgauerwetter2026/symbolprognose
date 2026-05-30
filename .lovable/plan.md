## Problem

`icon-eps-ingest.yml` läuft aktuell ausschliesslich über GitHub Actions `schedule:` (`*/30 * * * *`). GitHub-Cron ist bekanntlich unzuverlässig (Verzögerungen, übersprungene Runs bei Last, Auto-Deaktivierung bei Repo-Inaktivität). Der Radar-Ingest umgeht das bereits über einen Cloudflare-Worker, der alle 5 Min `/api/public/radar/ingest-trigger` aufruft, welcher dann GitHub Actions per `workflow_dispatch` startet. Für EPS fehlt dieser Pfad.

## Lösung

Gleiches Muster für EPS aufbauen:

1. **Dispatch-Helper** `src/lib/eps-dispatch.server.ts` analog `radar-dispatch.server.ts`
   - Throttle z.B. 10 Min (EPS-Runs alle 3–6 h, kein Bedarf für engere Frequenz)
   - Dispatched `icon-eps-ingest.yml`
   - Nutzt vorhandene Secrets `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPO`, `GITHUB_REF`

2. **Trigger-Endpoint** `src/routes/api/public/eps/ingest-trigger.ts` analog `radar/ingest-trigger.ts`
   - Akzeptiert POST mit `x-trigger-secret` (gleiches `RADAR_TRIGGER_SECRET` wiederverwenden, oder eigenes `EPS_TRIGGER_SECRET` — Empfehlung: gleiches, vereinfacht Worker)
   - CORS + Auth-Pattern 1:1 übernehmen

3. **Cron-Worker erweitern** `cron-worker/src/index.ts` + `wrangler.toml`
   - Zweiten Cron-Trigger hinzufügen, z.B. `*/15 * * * *` für EPS (oder gleicher 5-Min-Tick — Throttle im Server schützt)
   - Im `scheduled`-Handler beide URLs anpingen; cron event `cron` property unterscheidet die Zeitpläne
   - Neue Var `EPS_TARGET_URL` in `wrangler.toml`

4. **GitHub-Schedule als Backup behalten**
   - `*/30 * * * *` in `icon-eps-ingest.yml` bleibt unverändert; der Skript-No-Op bei bereits gerendertem Run verhindert Doppel-Arbeit

## Technische Details

- Throttle EPS-Dispatch: 10 Min (kürzer als MCH-Run-Frequenz, lang genug um Worker-Spam zu vermeiden)
- Im Worker: `event.cron === "*/15 * * * *"` → EPS, andere → Radar. Alternativ: beide bei jedem Tick triggern, da Server-Throttle ohnehin schützt (einfacher, robuster)
- Empfehlung: gleicher 5-Min-Tick für beide, EPS-Server-Throttle auf 10 Min → max. 6 Dispatches/h, GitHub-Quota unkritisch
- Keine Änderungen an `ingest_icon_eps.py`, `icon-eps-cache.server.ts`, oder Frontend

## Nicht im Plan

- Keine Frontend-Änderungen
- Kein Migrieren weg von GitHub Actions (eccodes/pygrib braucht Linux-Runtime, nicht im Worker machbar)
- Kein Anfassen des Radar-Pfads
