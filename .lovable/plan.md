## Ziel
Der Open-Meteo Cache Ingest soll nicht mehr bei jedem zweiten Lauf als „leer“/abgebrochen enden mit:

```text
Canceling since a higher priority waiting request for openmeteo-ingest exists
```

## Ursache
Der Trigger kommt regelmäßig rein, während ein vorheriger GitHub-Workflow noch läuft oder bereits wartet. Die aktuelle Prüfung sucht zwar aktive Runs, aber GitHub Actions kann zwischen `workflow_dispatch` und sichtbarem `queued`-Run kurzzeitig mehrere Dispatches annehmen. Dadurch verdrängt GitHub wartende Runs trotz `cancel-in-progress: false`.

## Plan
1. **Open-Meteo-Trigger robuster machen**
   - `src/lib/openmeteo-dispatch.server.ts` bekommt eine deutlich längere Mindestpause zwischen Dispatches, passend zur realen Ingest-Dauer.
   - Statt 30 Sekunden: ca. 14 Minuten, weil der Cron aktuell alle 15 Minuten Open-Meteo anstößt.
   - So wird höchstens ein Open-Meteo-Run pro Intervall ausgelöst.

2. **Race-Condition direkt nach Dispatch schließen**
   - `lastDispatchAt` wird bereits vor bzw. unmittelbar um den GitHub-Dispatch gesetzt, nicht erst ganz am Ende.
   - Damit blockiert auch ein zweiter nahezu gleichzeitiger Request aus derselben Serverinstanz sofort.

3. **Aktive-Run-Prüfung präzisieren**
   - Die GitHub-API-Abfrage bleibt erhalten.
   - Zusätzlich werden die neuesten Runs sortiert/ausgewertet, damit `queued`, `waiting`, `requested`, `pending`, `in_progress` zuverlässig als Sperre wirken.

4. **Cron-Kommentar korrigieren**
   - In `cron-worker/src/index.ts` steht noch „Open-Meteo nur alle 10 min“, der Code macht `minute % 15 === 0`.
   - Kommentar auf 15 Minuten korrigieren, ohne das Laufintervall zu ändern.

5. **Keine Änderung an Wetterdaten oder UI**
   - Keine Änderung am eigentlichen Ingest-Script, Cache-Format, Symbol-/Lokalprognose oder MCH-Code-Logik.

## Erwartetes Ergebnis
- Wenn noch ein Open-Meteo-Workflow läuft oder wartet, antwortet der Trigger sauber mit `429 throttled` statt einen neuen GitHub-Run zu dispatchen.
- GitHub Actions erzeugt keine „higher priority waiting request“-Abbrüche mehr für `openmeteo-ingest`.
- Der nächste reguläre 15-Minuten-Slot startet wieder normal, sobald kein aktiver Run mehr blockiert.