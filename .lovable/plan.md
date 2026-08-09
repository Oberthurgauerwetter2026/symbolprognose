# Blitzortung-Ingest läuft seit 3 Tagen nicht

## Befund (per GitHub-API geprüft, 09.08. 08:20 UTC)

Die gemeldete Meldung „Internal server error. Correlation ID …" stammt vom
letzten Blitzortung-Lauf am **06.08. 16:28 UTC** — ein GitHub-interner Ausfall
(Job nach 15 Min als „cancelled" beendet). Das war ein Einzelfall.

Das eigentliche Problem: **seit diesem Lauf gibt es überhaupt keinen
Blitzortung-Lauf mehr.** Belege:

```text
blitzortung-ingest.yml  letzter Run 06.08. 16:28  (event: schedule)
radar-ingest.yml        läuft weiter alle 5 Min   OK
openmeteo-ingest.yml    läuft weiter stündlich    OK
cron-worker-deploy      letzter Deploy 31.07. 14:47
cron-worker/src+toml    zuletzt geändert 06.08. 18:10 / 20:38
```

Alle bisherigen Blitzortung-Läufe wurden von GitHub `schedule:` ausgelöst, nie
vom Cron-Worker. Am 06.08. wurde `schedule:` aus dem Workflow entfernt und der
Trigger auf den Cloudflare-Cron-Worker umgestellt — der Worker wurde seitdem
aber **nicht neu deployt** (letzter Deploy 31.07.). Die im Repo stehende
`LIGHTNING_TARGET_URL` existiert in der laufenden Worker-Version also nicht,
darum wird der Blitz-Endpoint nie gepingt. Radar/Open-Meteo laufen weiter, weil
deren Variablen schon im Deploy vom 31.07. enthalten waren.

Ursache für den ausgebliebenen Deploy: der Workflow reagiert nur auf
`push`-Events auf `cron-worker/**`; dieser Push hat den Deploy nicht ausgelöst.

## Änderungen

1. **Cron-Worker neu deployen** — `cron-worker-deploy.yml` per
   `workflow_dispatch` starten. Danach triggert der Worker Blitzortung wieder
   alle 5 Minuten (und die Gewitter-Autowarnung im 5-Min-Takt, die aus dem
   gleichen Grund noch auf dem alten Stand lief).
2. **Damit das nicht wieder passiert**: `cron-worker-deploy.yml` bekommt
   zusätzlich einen täglichen `schedule:`-Deploy (03:10 UTC). Eine
   Konfigurationsänderung am Worker kann dann höchstens einen Tag ungenutzt
   liegen bleiben statt beliebig lange.
3. **Sichtbar machen**: In der Pipeline-Diagnose im Admin-Bereich wird pro
   Workflow zusätzlich der Cron-Worker-Deploy-Stand angezeigt (letzter
   erfolgreicher Deploy und ob danach noch Änderungen am Worker gepusht
   wurden). Ein „kein Lauf seit deutlich mehr als dem Soll-Intervall" wird als
   Fehler markiert, nicht nur als Alterswert.
4. Kein Codefix für die „Internal server error"-Meldung selbst: das ist ein
   GitHub-Infrastrukturfehler, der bereits von der bestehenden
   Infra-Fehler-Erkennung (`isInfraFailureRun`) abgefangen wird und einen
   sofortigen Nachhol-Dispatch erlaubt.

## Technische Details

- Deploy anstoßen: `POST /repos/{repo}/actions/workflows/cron-worker-deploy.yml/dispatches`
  (Token `GITHUB_DISPATCH_TOKEN`). Anschließend Kontrolle, dass innerhalb von
  10 Minuten ein `blitzortung-ingest`-Run mit `event: workflow_dispatch`
  erscheint.
- `.github/workflows/cron-worker-deploy.yml`: `schedule: - cron: "10 3 * * *"`
  ergänzen, restliche Steps unverändert.
- `src/lib/ingest-admin.functions.ts`: zusätzliche Abfrage der letzten
  `cron-worker-deploy.yml`-Runs; Rückgabe als `workerDeploy`-Feld.
- `src/routes/admin-warnungen.tsx`: Anzeige dieses Feldes in der
  Pipeline-Diagnose plus Stale-Markierung (Alter > 3× Soll-Intervall).
