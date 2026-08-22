# Radar-Ingest läuft nicht mehr: veralteter GitHub-Token in der Produktion

## Befund (geprüft, 07:50–07:53 UTC)

Der Cloudflare-Cron-Worker feuert weiterhin zuverlässig alle 5 Minuten — der
Trigger ist nicht das Problem. Die Produktions-Endpoints antworten aber mit 502:

```text
POST /api/public/radar/ingest-trigger      → 502
POST /api/public/lightning/ingest-trigger  → 502
Fehlertext: {"ok":false,"status":401,"error":"Bad credentials"} (GitHub)
```

Letzte GitHub-Läufe:

```text
radar-ingest       07:08 (mein manueller Test-Dispatch), davor 06:41 / 06:30
blitzortung-ingest 06:30 — seither keiner
openmeteo-ingest   06:30 — seither keiner
```

Alle automatischen Läufe brechen ab dem Zeitpunkt ab, ab dem der alte
GitHub-Token ungültig wurde. Der neue Token ist in den Projekt-Secrets
gespeichert und funktioniert (Test-Dispatch 07:08 lief durch), aber die
**veröffentlichte Version der Seite arbeitet noch mit dem alten Token** —
darum „Bad credentials". Kein Code-Fehler.

## Änderungen

1. **Neu veröffentlichen**, damit die Produktions-Umgebung den neuen
   `GITHUB_DISPATCH_TOKEN` übernimmt (Secret-Rebind + Publish). Das ist der
   eigentliche Fix.
2. **Kontrolle danach**: 10 Minuten warten und prüfen, dass wieder
   `radar-ingest`-Läufe mit `event: workflow_dispatch` im 5-Minuten-Takt
   erscheinen und die Endpoints 202/200/429 statt 502 liefern.
3. **Früher sichtbar machen** (kleine Ergänzung, kein Verhalten der Ingests):
   In der Pipeline-Diagnose im Admin-Bereich wird ein GitHub-401
   („Bad credentials") künftig als eigener, deutlicher Fehlerzustand
   „GitHub-Token ungültig — neu veröffentlichen" angezeigt, statt nur als
   allgemeiner Dispatch-Fehler. Dann ist derselbe Ausfall beim nächsten Mal in
   einem Blick erkennbar.

## Technische Details

- Publish überträgt die aktuellen Projekt-Secrets in den Produktions-Worker;
  ohne Publish bleibt der alte Wert aktiv, während Preview/Sandbox schon den
  neuen nutzt — genau das erklärt den Unterschied im Verhalten.
- `src/lib/gh-dispatch.server.ts`: bei HTTP 401 von GitHub eine eindeutige
  Fehlerkennung (`error: "github-bad-credentials"`) mitgeben.
- `src/lib/ingest-admin.functions.ts` / `src/routes/admin-warnungen.tsx`:
  diese Kennung als roten Hinweis mit Klartext-Handlungsanweisung darstellen.
- Keine Änderung an Zeitplänen, Schwellen, Karten oder Darstellung.
