# Niederschlagsradar: Prognose im 30-Minuten-Takt

## Ziel
Der Filmstrip rastet im Prognoseteil künftig auf halbe Stunden (:00 und :30) statt auf volle Stunden. Die Messung bleibt unverändert im 5-Minuten-Takt auf echten Radarframes.

## Verhalten
- Scrubben: Messung 5 min, Prognose 21:30, 22:00, 22:30 …
- Fällt eine halbe Stunde mit einem echten Prognoseframe zusammen (die Daten liegen im 15-min-Raster), rastet der Slider auf diese Frame-Zeit; sonst bleibt der virtuelle Zeitpunkt und die Karte interpoliert wie bisher.
- Abspielen bleibt flüssig: zwischen den Rasterpunkten wird weiter zwischen den 15-min-Bildern gemorpht; die Anzeigedauer pro Schritt ergibt sich automatisch aus der neuen Schrittweite.

## Technische Details
- Nur `src/components/maps/radar-map.tsx`, im `timelineSteps`-Memo (Prognoseblock, aktuell Stundenraster):
  - Schrittweite `HOUR` → `HALF = 30 * 60_000`, Startpunkt = erste halbe Stunde nach `nowMs`.
  - Snap-Toleranz auf ±7.5 min belassen (halbe 15-min-Kadenz), damit echte Frames weiterhin getroffen werden, ohne zwei Rasterpunkte auf denselben Frame zu legen.
- `gapAtMs` im Play-Loop liest die Schrittweite ohnehin aus dem Raster — keine Anpassung nötig.
- Keine Änderungen an `filmstrip-timeline.tsx`, Ingest oder Backend.
