## Ziel

Die noch sichtbare rechteckige Aussenkontur der Niederschlagsprognose soll durch ein deutlich welligeres, organisches Feld ersetzt werden — ohne Glättung, ohne Weichzeichnen, ohne Änderung der internen Farbbänder.

## Ursache

In `src/components/maps/radar-map.tsx` (Z. 513–529) moduliert der aktuelle Envelope (`env1` 0.28 + `env2` 0.9, Threshold 0.95) die Werte innerhalb der Datengrid-Bbox. Die Frequenzen sind aber zu hoch und der Threshold zu schwach, um die *äusseren* Ränder der Bbox aufzubrechen — das Datenrechteck bleibt sichtbar. Zusätzlich erzwingt das niederfrequente Signal `env1` einen relativ gleichmässigen Trend, der nahe den Bbox-Kanten kaum unter den Threshold fällt.

## Änderungen (nur Z. 513–529 von `radar-map.tsx`)

### 1) Stärker welliger Aussen-Envelope

- `env1`-Frequenz von `0.28` → `0.11` (grosse Lappen statt feiner Variation).
- `env2`-Frequenz von `0.9` → `0.45`, Gewicht von `0.25` → `0.35` (mittelgrosse Buchten/Halbinseln).
- Dritte hochfrequente Lage `env3` (`~1.6`, Gewicht `0.15`) für gezackte Mikro-Ränder (kein Glätten).
- Threshold von `0.95` → `1.05`, Verstärkung `2.6` → `2.9` → erzeugt deutlich grössere zusammenhängende Null-Zonen und damit eine welligere, nicht-rechteckige Aussenkontur.

### 2) Edge-Bias gegen die Bbox-Kanten

- Aus `fxRaw`/`fyRaw` einen normalisierten Abstand zur nächsten Bbox-Kante berechnen (`0` am Rand, `1` in der Mitte).
- Diesen Abstand mit `fbm` moduliert in den Envelope multiplizieren, sodass die rechteckige Datenkante zufällig „angeknabbert" wird statt linear abzuschneiden.
- Keine Änderung an `BUFFER`, `minV`, `colorFor`, `imageSmoothingEnabled` — Bänder und Härte bleiben identisch.

### 3) Nicht angefasst

- `colorFor` / `colorForSmooth` / `snowColorFor`
- Domain-Warp (`warpX`/`warpY`) und `mod`
- Timeline, Play-Loop, Ingest, Forecast-Pipeline
- Messdaten-Pfad (`!contour`) bleibt unverändert

## Erwartetes Resultat

Die Prognose-Felder enden in unregelmässigen, welligen Buchten mit Halbinseln und vorgelagerten Inseln; die rechteckige Datengrid-Kante ist nicht mehr erkennbar. Interne Iso-Bänder bleiben hart und gerastert.