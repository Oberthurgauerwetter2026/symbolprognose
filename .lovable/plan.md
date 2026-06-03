## Ziel
Die Niederschlags-Akkumulationsfarben kräftiger machen, näher am Radar-/Prognose-Farbschema (siehe `radar-map.tsx` SCALE: sattere Blau-, Grün-, Gelb-, Orange-, Rot-, Violetttöne).

## Änderung
In `src/components/maps/precip-accum-map.tsx`, `ACCUM_CLASSES` (Zeilen 107–118), die RGB-Werte je Klasse satter setzen. Klassengrenzen und Reihenfolge bleiben unverändert:

| Klasse (mm)   | bisher                  | neu                     |
|---------------|-------------------------|-------------------------|
| 0.3 – 1       | `[195, 220, 245]`       | `[150, 195, 235]`       |
| 1 – 2         | `[120, 170, 230]`       | `[95, 155, 220]`        |
| 2 – 5         | `[40, 110, 215]`        | `[40, 90, 195]`         |
| 5 – 10        | `[20, 50, 165]`         | `[20, 40, 150]`         |
| 10 – 20       | `[40, 170, 80]`         | `[55, 170, 75]`         |
| 20 – 30       | `[245, 230, 50]`        | `[245, 220, 55]`        |
| 30 – 50       | `[245, 160, 35]`        | `[240, 140, 35]`        |
| 50 – 75       | `[230, 55, 35]`         | `[220, 40, 40]`         |
| 75 – 100      | `[165, 30, 130]`        | `[170, 40, 180]`        |
| 100+          | `[95, 15, 100]`         | `[110, 20, 130]`        |

Keine weiteren Änderungen — Heatmap-Rendering, Border-Pass, Blur, Legende und alles andere bleiben gleich, sie lesen die Werte direkt aus `ACCUM_CLASSES`.
