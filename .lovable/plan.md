Zeitangabe im Filmstrip vergrössern

## Ziel
Die Zeitblase oberhalb des Filmstrips (z. B. in Radar und Wind) soll grösser und besser lesbar wirken, ohne das Layout der darunterliegenden Timeline zu beeinträchtigen.

## Änderung
- Datei: `src/components/maps/filmstrip-timeline.tsx`
- Betroffene Komponente: `FilmstripTimeline`
- Konkrete Anpassungen:
  - Schriftgrösse der Zeitblase von `text-[11px]` auf `text-[13px]` erhöhen.
  - Containerhöhe von `h-7` auf `h-9` anpassen, damit die grössere Schrift nicht abgeschnitten wird.
  - Padding der Blase von `px-2.5 py-1` auf `px-3 py-1.5` erhöhen.
  - Dreieck-Pfeil unter der Blase proportional vergrössern.

## Nicht im Scope
- Keine Änderung der Zeitlogik, des Scrollverhaltens oder der Farben.
- Keine Änderung an anderen Karten oder Komponenten.
