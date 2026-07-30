## Problem

Beim Anklicken einer Gemeinde in der Warnkarte wird die Fläche schwarz eingefärbt (`fillColor: "#111827"` in `styleFor`). Dadurch geht die Information über die Gefahrenstufe (grün/gelb/orange/rot) genau bei der Region verloren, die man gerade anschaut.

## Änderung

In `src/components/maps/warn-map.tsx`, Funktion `styleFor`:

- Ausgewählte Region behält ihre Stufenfarbe (`def.color`), leicht kräftiger (Füllung +0.08, max. 0.85).
- Auswahl wird nur noch über den Rand markiert: kräftigere Kontur im Banner-Blau (`#2561a1`), Stärke ca. 3, volle Deckkraft; nicht ausgewählte Regionen bleiben wie bisher.
- Hover (`hoverStyleFor`) bleibt eine dezente Abdunklung der Stufenfarbe; die Abdunklung wird leicht reduziert (ca. 0.10), damit Grün nicht grau wirkt.

Sonst keine funktionalen Änderungen.
