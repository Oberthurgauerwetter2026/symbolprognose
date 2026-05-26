Die Radar-Farbskalen für Regen und Schnee in `src/components/maps/radar-map.tsx` werden 1:1 an die MeteoSchweiz-Legende aus den Screenshots angepasst.

## Neue Regen-Skala (`SCALE`, Zeile 58–73)

Bins entsprechen jetzt exakt den Klassen aus dem Screenshot. Schwellwert = Untergrenze der Klasse:

| mm/h ab | Farbe (rgb) | Hex |
|---|---|---|
| 0.2 | 185, 170, 185 | `#b9aab9` (gräuliches Lila) |
| 1   | 30, 60, 230   | `#1e3ce6` (Blau) |
| 2   | 30, 120, 50   | `#1e7832` (Dunkelgrün) |
| 4   | 70, 200, 70   | `#46c846` (Hellgrün) |
| 6   | 240, 235, 50  | `#f0eb32` (Gelb) |
| 10  | 240, 200, 120 | `#f0c878` (Sand/Hellorange) |
| 20  | 240, 140, 30  | `#f08c1e` (Orange) |
| 40  | 225, 30, 30   | `#e11e1e` (Rot) |
| 60  | 150, 30, 200  | `#961ec8` (Magenta) |

`colorFor` bleibt strukturell gleich (volle Deckkraft).

## Neue Schnee-Skala (`SNOW_SCALE`, Zeile 89–100)

Nur zwei Klassen entsprechend Screenshot „leicht / stark":

| mm/h ab | Farbe (rgb) | Hex |
|---|---|---|
| 0.1 | 205, 195, 230 | `#cdc3e6` (leicht, helles Lila) |
| 2   | 150, 60, 200  | `#963cc8` (stark, kräftiges Lila) |

`snowColorFor` bleibt unverändert.

## Legende (Zeile 854–876)

- Regen-Legende zeigt automatisch die neuen Bins (kommt aus `SCALE`), Labels bleiben numerisch (mm/h-Untergrenze) — passt zur bestehenden Darstellung.
- Schnee-Legende: zwei Swatches („leicht" / „stark") statt der bisherigen Verlaufsreihe, da nur noch zwei Klassen existieren. Kleine Text-Labels werden ergänzt.

## Nicht verändert

- Render-Logik (`snowFrac > 0.3 ? snowColorFor : colorFor`) bleibt gleich.
- Datenquellen, Frames, Hagel-Overlay, MeteoSchweiz-PNG-Pfad: unverändert.
- Keine Änderungen an Ingest-Skripten oder anderen Karten.