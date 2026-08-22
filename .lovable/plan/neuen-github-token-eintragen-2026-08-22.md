# Neuen GitHub-Token eintragen

Der bisherige Token („Lovable Radar Trigger") läuft ab. Es muss nur der gespeicherte Wert erneuert werden – am Code ändert sich nichts.

## Vorgehen

1. Ich öffne das sichere Eingabefeld für `GITHUB_DISPATCH_TOKEN`; du fügst den neuen Token dort ein (er läuft nie über den Chat).
2. Danach prüfe ich, ob die Ingest-Auslösung wieder funktioniert (Radar-Trigger-Aufruf, Rückmeldung `dispatched` bzw. `already-running` statt Auth-Fehler).
3. Falls der Token auch im Cloudflare-Trigger-Worker als eigenes Secret liegt, weise ich dich darauf hin, wo er dort ebenfalls ersetzt werden muss.

## Voraussetzungen am Token

- Fine-grained PAT für das Repo dieses Projekts.
- Berechtigung „Actions: Read and write" (für `workflow_dispatch` und das Abfragen laufender Runs), plus „Metadata: Read".
- Laufzeit gern länger wählen (z. B. 1 Jahr), damit die Erneuerung nicht so schnell wieder ansteht.

## Technische Details

- Genutzt wird `process.env.GITHUB_DISPATCH_TOKEN` in `src/lib/gh-dispatch.server.ts` (zusammen mit `GITHUB_REPO`); alle Dispatch-Module (Radar, AROME, Open-Meteo, MCH, Symbol, Blitze) laufen darüber.
- Keine Code-Änderung, keine Datenbank- oder Workflow-Anpassung nötig.
