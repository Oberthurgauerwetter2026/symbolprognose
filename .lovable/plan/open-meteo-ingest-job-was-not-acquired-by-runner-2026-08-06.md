# Open-Meteo-Ingest: „Job was not acquired by Runner"

## Was passiert ist

Die Meldung `The job was not acquired by Runner of type hosted even after multiple attempts` kommt von GitHub selbst: der Lauf wurde korrekt gestartet, GitHub konnte aber keine Maschine (hosted runner) zuweisen. Kein Schritt des Workflows lief, unser Skript ist nicht schuld. Solche Ausfälle treten unregelmässig auf und lassen sich nicht verhindern — man kann nur dafür sorgen, dass der nächste Versuch schnell nachkommt.

## Aktuelles Problem dabei

Nach so einem Fehlschlag dauert es bis zu 30 Minuten, bis überhaupt wieder ein Versuch startet: der Dispatcher hat eine feste 28-Minuten-Sperre (`MIN_INTERVAL_MS`), die noch **vor** der Prüfung greift, ob der letzte Lauf erfolgreich war. Ein fehlgeschlagener Lauf soll laut Kommentar sofort neu versucht werden dürfen — die Sperre verhindert das. Ergebnis: Prognose-/Radarcache bleibt unnötig lange alt.

## Änderung

1. **Sofortiger Neuversuch nach Fehlschlag**: Die Reihenfolge im Dispatcher wird umgedreht — zuerst die GitHub-Abfrage (läuft schon etwas? war der letzte Lauf erfolgreich?), danach die Zeitsperre. Die reine Doppelklick-Sperre wird auf 3 Minuten reduziert; die 28-Minuten-Logik bleibt nur für **erfolgreiche** bzw. noch laufende Läufe.
2. **Runner-Ausfall erkennen und benennen**: Läufe, die ohne ausgeführten Schritt scheitern (`conclusion: failure` bei Dauer unter ~1 Minute, oder `startup_failure`), werden als GitHub-Infrastrukturfehler behandelt und ausdrücklich freigegeben für einen Neuversuch.
3. **Sichtbarkeit im Admin**: In der Pipeline-Diagnose auf `/admin-warnungen` wird beim Open-Meteo-Eintrag der letzte Fehlschlagsgrund kurz angezeigt (z.B. „letzter Lauf: Runner nicht verfügbar — Neuversuch beim nächsten Takt"), damit klar ist, dass es kein Datenfehler ist.

Nicht geändert: Workflow-Inhalt, Grid-Auflösungen, Open-Meteo-Limits, 5-Minuten-Cron des Workers.

## Technische Details

- `src/lib/openmeteo-dispatch.server.ts`: `fetchRecentRuns()` vor den Interval-Check ziehen; `MIN_INTERVAL_MS` von 28 min auf 3 min (nur Burst-Schutz), `RECENT_RUN_GUARD_MS` (28 min) unverändert und nur bei `status !== "completed" || conclusion === "success"`. `blocksRetry` zusätzlich `false` setzen, wenn `conclusion` in `{failure, startup_failure, cancelled}` liegt und `run_started_at → updated_at` unter 60 s liegt (Runner-Ausfall).
- Rückgabetyp um `reason: "runner-unavailable"`-Info im Erfolgsfall (`retryOf`) erweitern, damit der Trigger-Endpunkt es loggt.
- `src/routes/admin-warnungen.tsx` (Pipeline-Diagnose): letzten Run-Status je Workflow inkl. Kurzbegründung anzeigen; Datenquelle ist die bestehende GitHub-Abfrage im Diagnose-Server-Fn.
- Kein Migrations- oder Datenbankanteil.
