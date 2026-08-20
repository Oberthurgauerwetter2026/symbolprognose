# Warnkarte auf Radar-/Wind-Höhe bringen

## Beobachtung
Auf dem Screenshot ist die Warnkarte rund 460 px hoch, Radar und Wind sind 600 px. Ursache: im breiten Desktop-Layout bekommt der Kartenbereich `h-full`, damit richtet sich seine Höhe nach der Zeilenhöhe des Grids — und die wird vom kürzeren Info-/Abo-Panel rechts bestimmt, nicht von 600 px.

## Änderung
In `src/components/maps/warn-map.tsx`:
- Die Karte erhält im Desktop-Breakpoint eine feste Höhe von 600 px statt `h-full`, mobil bleibt es bei 560 px (identisch zu Radar/Wind).
- Die rechte Spalte (Legende/Info + Abo) bleibt auf 600 px begrenzt und scrollt intern weiter, damit beide Spalten oben und unten bündig abschliessen.

## Ergebnis
Warnkarte: 560 px mobil, 600 px ab Tablet/Desktop — exakt wie Niederschlagsradar und Wind.
