# „Job was not acquired by Runner“ dauerhaft entschärfen

## Bestätigter Stand

- Alle Workflows nutzen `runs-on: ubuntu-latest` (geprüft in allen 7 Workflow-Dateien).
- Der Dispatcher `src/lib/openmeteo-dispatch.server.ts` erkennt Infrastruktur-Fehlschläge bereits (`isInfraFailure`, Läufe unter 60 s) und gibt den nächsten 5-Minuten-Takt frei.

Die Meldung selbst kommt von GitHub: der Lauf wurde angenommen, aber keine Maschine zugewiesen. Kein Schritt lief, das Skript ist nicht beteiligt. Verhindern lässt sich das nicht — nur die Trefferquote verbessern und der Ausfall überbrücken.

## Änderungen

1. **Runner-Label pinnen**: In allen Ingest-Workflows `ubuntu-latest` → `ubuntu-24.04`. Das `latest`-Label wird gerade migriert und ist bei GitHub die häufigste Ursache für fehlende Runner-Zuweisung; ein festes Image nutzt einen stabileren Pool.
2. **Sofort-Neuversuch statt Warten auf den nächsten Takt**: Erkennt der Dispatcher einen Infra-Fehlschlag (`runner-unavailable`), löst er direkt nach dem Dispatch keinen zweiten Lauf aus, sondern der Trigger-Endpunkt gibt das Ergebnis mit `retryOf.reason` zurück; zusätzlich wird der Burst-Schutz (`MIN_INTERVAL_MS`) für diesen Fall vollständig umgangen (heute schon so, wird abgesichert und getestet).
3. **Gleiche Infra-Erkennung für alle Pipelines**: Die Logik steckt bisher nur im Open-Meteo-Dispatcher. Sie wird in `gh-dispatch.server.ts` als gemeinsame Hilfsfunktion `isInfraFailureRun()` bereitgestellt und in Radar-, Symbol-, AROME-, Blitz- und MCH-Dispatcher genutzt, damit auch dort ein Runner-Ausfall sofort nachgeholt wird statt bis zum regulären Takt zu warten.
4. **Sichtbarkeit**: In der Pipeline-Diagnose auf `/admin-warnungen` wird pro Workflow gezählt, wie viele der letzten 10 Läufe Runner-Ausfälle waren (z.B. „3 von 10 Läufen ohne Runner“), damit erkennbar bleibt, ob es sich um eine GitHub-Störung oder ein Datenproblem handelt.

Nicht geändert: Skriptinhalte, Grid-Auflösungen, Open-Meteo-Limits, 5-Minuten-Cron des Workers, Concurrency-Einstellungen.

## Technische Details

- `.github/workflows/{openmeteo-ingest,openmeteo-symbol,radar-ingest,arome-ingest,blitzortung-ingest,mch-local-forecast}.yml`: `runs-on: ubuntu-24.04`.
- `src/lib/gh-dispatch.server.ts`: `isInfraFailureRun(run)` exportieren (Bedingung: `status === "completed"`, `conclusion` in {failure, startup_failure, cancelled} und Laufzeit `run_started_at → updated_at` < 60 s, oder `startup_failure`); zusätzlich `getRecentRuns(workflowFile)` als gemeinsame Leseabfrage.
- `src/lib/openmeteo-dispatch.server.ts`: lokale `isInfraFailure` durch den gemeinsamen Helper ersetzen.
- `src/lib/{radar,symbol,arome,lightning,mch-local-forecast}-dispatch.server.ts`: vor dem Throttle die letzten Läufe prüfen und bei Infra-Fehlschlag den Throttle überspringen.
- `src/lib/ingest-admin.functions.ts` + `src/routes/admin-warnungen.tsx`: Zähler der Runner-Ausfälle in die Diagnose aufnehmen.
- Kein Datenbank- oder Migrationsanteil.
