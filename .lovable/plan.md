# Lokalprognose-Snippet: erst nach Ortswahl aufklappen

## Problem

Im Embed `/embed/lokalprognose` startet das Widget nicht immer leer: es lädt einen früher gespeicherten Ort aus dem Browserspeicher und startet zusätzlich automatisch eine Standortabfrage. Dadurch klappt die Prognose ohne Zutun des Nutzers auf.

## Ziel

Das Snippet zeigt beim Laden nur den Suchkopf (Suchfeld + „Ortung“-Button) plus den kurzen Hinweistext. Erst wenn der Nutzer einen Ort eingibt/auswählt oder „Ortung“ drückt, klappt die vollständige Lokalprognose auf und das iframe wächst mit.

## Umsetzung

1. `src/components/weather-widget.tsx`
   - Neue optionale Prop `requireExplicitLocation?: boolean` (Standard `false`, ändert bestehende Seiten nicht).
   - Wenn gesetzt: kein Lesen des gespeicherten Orts aus dem Browserspeicher beim Start und keine automatische Standortabfrage. Manuelle Suche und der „Ortung“-Button funktionieren unverändert.
   - Der bestehende Hinweisblock „Gemeinde suchen oder ‚Ortung‘ verwenden“ bleibt der Startzustand; kein Skeleton, kein leerer Prognoseblock.

2. `src/routes/embed.lokalprognose.tsx`
   - `requireExplicitLocation` setzen, ausser es wurde per Suchparameter (`lat`/`lon`/`name`) ein Ort vorgegeben — dann startet das Snippet wie bisher direkt mit diesem Ort.

3. Optional gleiche Behandlung für `/embed/lokal-suche` (kompakte Variante), damit beide Suchen-Snippets identisch starten.

## Prüfung

- `/embed/lokalprognose` mit vorher gespeichertem Ort im Browser öffnen: es erscheint nur der Suchkopf.
- Ort eingeben: volle Prognose klappt auf, Höhe wird per postMessage gemeldet.
- `/karten/lokal` bleibt unverändert (Speicher + Ortung wie bisher).
