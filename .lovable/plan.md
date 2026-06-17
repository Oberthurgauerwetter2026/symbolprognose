## Ziel
Einzelne unnötig leere Open‑Meteo Cache Ingest Runs wie `#2634` sollen nicht mehr entstehen.

## Vermutete Restursache
Die bisherige Sperre ist noch zu lokal:
- `lastDispatchAt` ist nur In‑Memory pro Serverinstanz wirksam.
- Der GitHub-Check blockiert aktuell nur aktive Runs (`queued`, `in_progress`, usw.), aber nicht zuverlässig einen sehr kürzlich erzeugten oder gerade gecancelten Run.
- Der Cron triggert Open‑Meteo weiterhin alle 15 Minuten; wenn ein Lauf länger braucht oder GitHub Dispatch/Queue verzögert sichtbar wird, entstehen weiterhin einzelne unnötige Workflow-Runs.

## Plan
1. **Globalen GitHub-Recent-Run-Guard einbauen**
   - In `src/lib/openmeteo-dispatch.server.ts` nicht nur aktive Runs prüfen.
   - Zusätzlich den neuesten Open‑Meteo-Workflow-Run aus GitHub auswerten, unabhängig vom Status.
   - Wenn der letzte Run jünger als ca. 28 Minuten ist, keinen neuen Dispatch senden.
   - Antwort sauber als `429 throttled` mit neuem Grund `recent-run` zurückgeben, inklusive Run-ID, Status, Conclusion und CreatedAt.

2. **Open‑Meteo-Takt auf 30 Minuten setzen**
   - In `cron-worker/src/index.ts` `includeOpenmeteo` von `minute % 15 === 0` auf `minute % 30 === 0` ändern.
   - Kommentare und Statusbeschreibung entsprechend auf 30 Minuten korrigieren.
   - Damit werden die unnötigen Zwischen-Trigger gar nicht mehr angeboten, statt nur serverseitig abgewiesen.

3. **Lokalen Sofortschutz angleichen**
   - `MIN_INTERVAL_MS` in `openmeteo-dispatch.server.ts` auf denselben Guard-Zeitraum setzen.
   - Die In‑Memory-Sperre bleibt als schneller Schutz gegen Doppelrequests derselben Instanz erhalten, ist aber nicht mehr die Hauptsperre.

4. **Aktive-Run-Prüfung robuster machen**
   - Workflow-Runs explizit nach `created_at` sortieren.
   - Zuerst aktive Runs blockieren.
   - Danach den neuesten Run als Recent-Run-Guard prüfen.

5. **Keine Änderung an Wetterdaten/UI**
   - Keine Änderung an `scripts/ingest_openmeteo.py`.
   - Keine Änderung an Cache-Format, MCH/local_forecast, Symbolprognose oder Wettercodes.

## Erwartetes Ergebnis
- Maximal ein Open‑Meteo Cache Ingest pro ca. 30 Minuten.
- Keine unnötigen leeren Zwischenläufe mehr durch 15‑Minuten-Dispatches.
- Falls doch ein Trigger zu früh kommt, endet er als kontrolliertes `429 throttled` am Trigger-Endpoint, ohne einen GitHub-Workflow-Run anzulegen.