Der Fehler kommt jetzt nicht mehr vom Upload, sondern vom Anlegen des Cron-Triggers: Cloudflare verlangt dafür trotzdem, dass im Account einmalig eine workers.dev-Subdomain initialisiert wurde. `workers_dev = false` verhindert nur die öffentliche Worker-URL, aber nicht diese Account-Voraussetzung für Cron-Schedules.

Plan:

1. `cron-worker/wrangler.toml` so anpassen, dass die bisherige falsche Annahme nicht stört, aber die Cron-Konfiguration sauber bleibt.
2. `.github/workflows/cron-worker-deploy.yml` robuster machen:
   - Wrangler 4 im Worker-Verzeichnis verwenden, statt der alten globalen Wrangler-3-Version.
   - Optional vor dem Deploy klarere Logs ausgeben, damit bei Cloudflare-Account-Setup-Problemen sofort sichtbar ist, was fehlt.
3. In der Antwort klar nennen, dass zusätzlich einmalig in Cloudflare die Workers-Seite geöffnet werden muss, damit Cloudflare die workers.dev-Subdomain erstellt. Das ist eine Cloudflare-Account-Voraussetzung und kann nicht per Repo-Code vollständig umgangen werden.

Nach Umsetzung:
- Commit/push auf `main` löst den Workflow erneut aus.
- Wenn die workers.dev-Subdomain im Cloudflare-Account einmalig erstellt ist, sollte der Cron-Schedule danach erfolgreich gesetzt werden.