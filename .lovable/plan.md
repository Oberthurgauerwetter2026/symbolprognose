# Blitz-Archiv: abwarten und prüfen

Keine weiteren Code-Änderungen. Die Korrektur am Blitz-Ingest ist bereits umgesetzt; jetzt geht es nur noch um die Kontrolle, ob sie greift.

## Was passiert von selbst

- Der Ingest läuft alle 5 Minuten und hört pro Lauf 280 Sekunden mit.
- Das Archiv wird nur noch geschrieben, wenn die zuvor erfassten Blitze weiterhin enthalten sind.
- Das Archiv baut sich ab jetzt neu auf; ältere Blitze aus der Vergangenheit sind nicht wiederherstellbar.

## Kontrolle in ~15 Minuten

1. Niederschlagsradar öffnen und im Filmstrip über die letzten Messschritte scrubben.
2. Erwartung: Blitze erscheinen nicht nur im aktuellsten Frame, sondern über mehrere zurückliegende 5-Minuten-Schritte.
3. Falls weiterhin nur der neueste Frame Blitze zeigt, melden — dann sehen wir uns die Ingest-Läufe und die Archivdatei erneut an.

## Hinweis

Bei blitzfreier Wetterlage sind leere Frames normal. Ein aussagekräftiger Test braucht eine Gewitterlage im Erfassungsgebiet.
