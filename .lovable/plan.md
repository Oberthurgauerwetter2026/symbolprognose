# Stundenprognose: Inhalte springen beim Scrollen nicht mehr

## Problem
In der Stundenleiste der Lokalprognose haben 1-Stunden-Slots kleinere Wettersymbole (48 px) und kleinere Temperaturzahlen als 3-Stunden-Slots (64 px). Dadurch sitzen Symbol, Temperatur und Wind in den beiden Slot-Typen auf unterschiedlicher Höhe — beim horizontalen Scrollen wirkt es, als würden die Inhalte hoch und runter schweben.

## Umsetzung (`src/components/weather-widget.tsx`, Stundenleiste)

1. **Symbol-Zeile mit fester Höhe**: Der Symbol-Container bekommt eine feste Höhe (64 px, bisherige Maximalhöhe) und zentriert das Symbol darin — unabhängig davon, ob es ein 48- oder 64-px-Symbol ist.
2. **Temperatur-Zeile vereinheitlichen**: Gleiche Schriftgrösse/Zeilenhöhe für 1h- und 3h-Slots (festes `h-`/Leading), damit die Temperatur in allen Slots auf derselben Höhe steht.
3. **Wind-/Böen-Zeile stabilisieren**: Falls Böen- oder Zusatzzeilen nur bei manchen Slots vorhanden sind, bekommen diese Zeilen eine feste Mindesthöhe, damit nichts nachrutscht.
4. Symbolgrössen selbst bleiben unterschiedlich (48/64 px erkennbarer Kadenz-Unterschied), nur ihre vertikale Mittelachse wird ausgerichtet.

## Prüfung
- Typecheck + Build.
- Browser-Check: Beim horizontalen Scrollen über den 1h-/3h-Übergang bleiben Uhrzeit, Symbolmitte, Temperatur und Wind auf konstanter Höhe.
