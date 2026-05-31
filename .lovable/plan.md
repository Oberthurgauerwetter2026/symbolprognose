## Ziel

In `src/components/maps/radar-map.tsx`:

1. **Hinweis-Block entfernen** ("Aktuell kein Niederschlag …" inkl. "Zum nächsten Regen springen"). Komplettes `{showDryHint && (...)}` Element (Zeilen ~1221–1239) wird gelöscht. Die Hilfsvariablen `showDryHint` / `nextWetIdx` werden ebenfalls entfernt, falls nur noch hier verwendet (vorab prüfen — sonst stehen lassen).

2. **Farblegende auf Smartphone sichtbar machen.** Aktuell hat der Legenden-Container (Zeile 1069) die Klassen `hidden ... sm:flex` → unter 640 px komplett ausgeblendet.

   Änderung: `hidden ... sm:flex` → `flex` (immer sichtbar). Damit die Legende auf schmalen Viewports nicht zu viel Karte überdeckt, wird sie auf Mobile kompakter:
   - Container: `right-3 top-24` bleibt; Padding `p-1.5 sm:p-2`.
   - Farbfelder: `h-2.5 w-3 sm:h-3 sm:w-4`.
   - Zeilenabstand `gap-0.5`, Textgrösse `text-[9px] sm:text-[10px]`.

   Inhalte (mm/h-Skala + Schnee-Skala) unverändert.

## Nicht angefasst

Radar-Logik, Frames, Opazität, Overlays, Timeline, Hagel-Button, Steuerung, Farbskalen-Werte.

## Validierung

- Mobile (≤640 px): kleine Niederschlags- und Schnee-Legende sichtbar oben rechts.
- Desktop: Legende sieht aus wie bisher.
- Kein "Aktuell kein Niederschlag"-Hinweis mehr unter der Toolbar.
