# Ingest-Workflows stabilisieren

## Befund (aus den Live-Logs und den R2-Daten geprüft, 18:03 UTC)

Datenstand in R2:

```text
mch/local_forecast.json   18:04  frisch  (stündlich)  OK
radar/frames.json         17:46  17 Min alt (soll 5 Min)
openmeteo/forecast.json   15:15  ~2h50 alt (soll 30 Min)
arome/frames.json         15:10  ~2h50 alt (soll stündlich)
lightning/latest.json     14:42  ~3h20 alt (soll 5 Min)
openmeteo/symbol.json     14:06  planmäßig (4×/Tag)  OK
```

Vier konkrete Ursachen, alle in den Worker-Logs sichtbar:

1. **GitHub antwortet zeitweise mit HTTP 500** auf `workflow_dispatch`
   (`{"message":"Failed to run workflow dispatch", "status":"500"}`) — z.B. 18:01
   und 18:06 für Radar und Open-Meteo. Unser Endpoint gibt den Fehler direkt als
   502 zurück und versucht es nicht erneut; der ganze 5-Minuten-Slot fällt aus.
   Danach greift zusätzlich der Throttle, also fällt teils auch der Folgeslot aus.
2. **`/api/public/eps/ingest-trigger` liefert 404** — die Route existiert nicht
   (mehr), der Cron-Worker pingt sie aber bei jedem Lauf (`EPS_TARGET_URL`).
3. **Ein Fremd-Trigger ohne Secret** feuert jede 5. Minute auf
   `radar/ingest-trigger` und wird mit 401 abgewiesen (Log: „header fehlt").
   Das ist der alte Worker `cloudflare/radar-trigger-worker` bzw. ein alter
   externer Cron — er verursacht nur Rauschen, aber verschleiert echte Fehler.
4. **Blitzortung läuft noch über GitHub `schedule:`** — genau der Mechanismus,
   der bei allen anderen Workflows schon als unzuverlässig entfernt wurde;
   entsprechend 3h alt.

Offen (nicht mit den vorhandenen Signalen belegbar): Warum AROME und Open-Meteo
trotz erfolgreichem Dispatch (202 um 18:01) keine neuen Daten geschrieben haben —
das kann nur der GitHub-Run-Status zeigen. Darum ist Schritt 4 unten eine
Diagnose, keine Behauptung.

## Änderungen

1. **Retry bei transienten GitHub-Fehlern**: Alle Dispatch-Helper
   (radar, openmeteo, arome, mch, symbol) versuchen bei HTTP 5xx bzw. 429 bis zu
   3× mit kurzem Backoff (0.5s/1.5s). Der Throttle-Zeitstempel wird erst bei
   Erfolg gesetzt, damit ein gescheiterter Slot sofort nachgeholt werden darf.
2. **EPS-Trigger entfernen**: `EPS_TARGET_URL` aus `cron-worker/wrangler.toml`
   und die EPS-Zweige aus `cron-worker/src/index.ts` löschen (inkl. `/run/eps`).
3. **Blitzortung an den Worker hängen**: `schedule:` aus
   `.github/workflows/blitzortung-ingest.yml` entfernen, neuen Endpoint
   `/api/public/lightning/ingest-trigger` (gleiche Secret-Prüfung, eigener
   Dispatch-Helper) anlegen und im Cron-Worker alle 5 Min triggern
   (`LIGHTNING_TARGET_URL`, plus `/run/lightning` für manuelle Tests).
4. **Diagnose sichtbar machen**: Der bestehende Admin-Bereich bekommt eine
   kompakte Ingest-Statusliste, die pro Workflow den letzten GitHub-Run
   (Status, conclusion, Zeit) und das Alter der zugehörigen R2-Datei zeigt.
   Damit ist beim nächsten Ausfall in einem Blick klar, ob der Trigger oder das
   Skript scheitert — das klärt auch die offene AROME/Open-Meteo-Frage.
5. **Alt-Trigger stilllegen**: `cloudflare/radar-trigger-worker/` wird als
   veraltet markiert (README-Hinweis) — der Cloudflare-seitige Worker muss von
   dir mit `npx wrangler delete` im Ordner entfernt werden, sonst laufen die
   401-Pings weiter. Das kann ich nicht aus dem Projekt heraus tun.

## Technische Details

- Neuer gemeinsamer Helper `src/lib/gh-dispatch.server.ts`: `dispatchWorkflow(file, {minIntervalMs})`
  mit Retry/Backoff und Throttle-Set-on-success; die bestehenden
  `*-dispatch.server.ts` rufen ihn auf und behalten ihre Rückgabetypen.
- Neu: `src/lib/lightning-dispatch.server.ts` +
  `src/routes/api/public/lightning/ingest-trigger.ts` (Muster wie radar).
- `cron-worker/src/index.ts`: `lastEps` entfernen, `lastLightning` ergänzen,
  `triggerFiveMin` um Lightning erweitern; `wrangler.toml` Vars anpassen.
  Deploy des Cron-Workers erfolgt über den bestehenden Workflow
  `cron-worker-deploy.yml`.
- Admin-Status: neuer Server-Fn-Endpoint, der pro Workflow
  `GET /repos/{repo}/actions/workflows/{file}/runs?per_page=1` liest
  (Token `GITHUB_DISPATCH_TOKEN`, nur serverseitig) und die R2-`generatedAt`-Werte
  via `r2ObjectUrlCandidates` prüft.
