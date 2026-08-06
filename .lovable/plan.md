# Radar-Ingest: selbstständige Abbrüche verhindern

## Bestätigte Ursache

Der Workflow verwendet bereits `cancel-in-progress: false`. GitHub Actions lässt in einer Concurrency-Gruppe jedoch nur einen laufenden und einen wartenden Run zu. Kommt währenddessen ein weiterer Dispatch, wird der ältere **wartende** Run mit „Canceling since a higher priority waiting request … exists“ ersetzt.

Der aktuelle 4-Minuten-Throttle in `radar-dispatch.server.ts` ist nur eine Variable im Speicher einer Server-Instanz. Bei mehreren Instanzen, Neustarts oder zusätzlichen manuellen Triggern ist er nicht global wirksam. Deshalb gelangen weiterhin mehrere Radar-Runs in die GitHub-Warteschlange.

## Änderung

1. Vor jedem Radar-Dispatch über die GitHub-API prüfen, ob für `radar-ingest.yml` bereits ein Run mit Status `queued` oder `in_progress` existiert.
2. Wenn ja, **keinen neuen Run anlegen** und den Trigger als „busy/already running“ beantworten. Der nächste 5-Minuten-Cron versucht es erneut.
3. Erst wenn kein aktiver oder wartender Run vorhanden ist, `workflow_dispatch` auslösen.
4. Den bisherigen flüchtigen 4-Minuten-Throttle als zusätzlichen Schutz behalten, aber nicht mehr als Hauptsperre behandeln.
5. Antworten und Worker-Logs klar unterscheiden: `dispatched`, `already-running`, `throttled` und echter GitHub-Fehler.
6. Den Workflow selbst bei `cancel-in-progress: false` belassen; dadurch wird ein bereits laufender Ingest niemals zugunsten eines neuen Triggers beendet.

## Technische Dateien

- `src/lib/gh-dispatch.server.ts`: read-only Abfrage der Workflow-Runs mit Retry/Fehlerbehandlung ergänzen.
- `src/lib/radar-dispatch.server.ts`: globale Busy-Prüfung unmittelbar vor dem Dispatch einbauen und Result-Typ erweitern.
- `src/routes/api/public/radar/ingest-trigger.ts`: Busy-Ergebnis als erfolgreiche Nicht-Ausführung zurückgeben, nicht als Serverfehler.
- `cron-worker/src/index.ts`: Busy-Antwort im Status/Log korrekt als „bereits aktiv“ ausgeben.

## Prüfung

- Trigger bei bereits laufendem Radar-Ingest aufrufen: kein zusätzlicher GitHub-Run wird erzeugt.
- Nach Abschluss erneut triggern: genau ein neuer Run wird erzeugt.
- Kontrollieren, dass keine neuen Runs mehr mit der genannten Concurrency-Meldung abbrechen.
