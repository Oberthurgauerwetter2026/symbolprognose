# Radar-Ingest fällt aus: hängender Lauf blockiert alle weiteren Trigger

## Befund (geprüft, 16:05 UTC via GitHub-API)

```text
41925  queued (seit 15:15, > 50 Min)   workflow_dispatch
41924  startup_failure  15:10
41923  failure (keine Job-Schritte)  15:05
41922  success  15:00   ← letzter erfolgreicher Lauf
```

GitHub meldet aktuell „Partial System Outage" mit einem offenen
Actions-Incident (seit 15:11 UTC). Die Läufe 41923/41924 brachen infrastrukturell
ab (keine Job-Schritte ausgeführt), 41925 hängt seither in der Warteschlange.

Der eigentliche Folgefehler liegt bei uns: Vor jedem Dispatch prüft
`getWorkflowActivity`, ob ein Lauf `queued` oder `in_progress` ist, und
antwortet dann mit `alreadyRunning` statt zu triggern. Da 41925 seit 50 Minuten
hängt, wird seitdem **kein** neuer Radar-Dispatch mehr abgesetzt — der Ausfall
verlängert sich also über die GitHub-Störung hinaus, bis der Lauf irgendwann
verworfen wird.

## Änderungen

1. **Hängende Läufe nicht mehr als „läuft" zählen.** Ein Lauf, der länger als
   12 Minuten `queued` ist (Radar-Lauf dauert normal ~3 Min), gilt als
   verwaist: der Trigger wird durchgelassen statt blockiert.
2. **Verwaisten Lauf vorher abbrechen**, damit die Concurrency-Queue frei ist
   und GitHub den neuen Lauf nicht sofort wieder cancelt.
3. Gleiches Verhalten für die anderen Ingests, die dieselbe Aktivitätsprüfung
   nutzen (Blitzortung, Open-Meteo, AROME, MCH, Symbol) — eine gemeinsame
   Schwelle im geteilten Helper, keine Sonderlogik pro Workflow.
4. **Sichtbar machen:** In der Pipeline-Diagnose im Admin-Bereich wird ein
   Lauf, der zu lange wartet, als eigener Zustand „hängt in Warteschlange
   (GitHub-Störung)" angezeigt statt als „läuft".

Kein Eingriff in Zeitpläne, Schwellen, Karten oder Darstellung. Solange die
GitHub-Störung anhält, können Läufe weiter scheitern — nach ihrem Ende holt der
5-Minuten-Cron dann aber sofort wieder auf, statt blockiert zu bleiben.

## Technische Details

- `src/lib/gh-dispatch.server.ts`: `getWorkflowActivity` bekommt
  `staleQueuedAfterMs` (Default 12 Min) und ignoriert `queued`-Läufe, die älter
  sind; zusätzlich neuer Helper `cancelWorkflowRun(runId)`
  (`POST /actions/runs/{id}/cancel`).
- `src/lib/radar-dispatch.server.ts`: bei erkanntem Stale-Lauf einmal
  `cancelWorkflowRun` aufrufen, dann normal dispatchen; `lastDispatchAt`
  weiterhin nur bei Erfolg setzen.
- `src/lib/ingest-admin.functions.ts` + `src/routes/admin-warnungen.tsx`:
  Kennzeichnung `stuckQueued` in der Diagnose-Anzeige.
