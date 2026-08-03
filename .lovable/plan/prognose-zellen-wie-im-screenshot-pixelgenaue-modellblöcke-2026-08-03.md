# Prognose-Zellen wie im Screenshot: pixelgenaue Modellblöcke

## Was der Screenshot zeigt (geprüft am Bild)

Die Zellen sind **nicht** organisch verzogen, sondern klar erkennbare, achsenparallele Pixelblöcke des Modellgitters mit **harten Treppenkanten** und **scharf abgesetzten Farbstufen** (verschachtelte Bänder hell → dunkelblau). Keine Weichzeichnung, kein Blur, keine gewellten Ränder.

## Ausgangslage im Code (geprüft in `src/components/maps/radar-map.tsx`)

- Prognose-Frames werden mit einem organischen Domain-Warp (`warpX` / `warpY`, `ORGANIC_AMP = 0.65`) verzogen — in beiden Grid-Pfaden (Zeilen ~730 und ~863) und im PNG-/Morph-Pfad (~1361).
- Zusätzlich läuft eine schwache Kantenglättung (`smoothEdge` an zwei Stellen, `ensureSmooth` im PNG-Pfad).
- Gesampelt wird **bilinear**, und das Offscreen-Canvas wird mit `imageSmoothingEnabled = true` / `quality = "high"` hochskaliert. Beides weicht die Blockkanten auf.

Das ist genau das Gegenteil der Screenshot-Optik.

## Änderungen (nur `src/components/maps/radar-map.tsx`, reine Darstellung)

1. **Warp für Prognose deaktivieren**: `warpX` / `warpY` nicht mehr auf Prognose-Frames anwenden (alle drei Aufrufstellen). Kanten verlaufen wieder gitterparallel wie im Screenshot. Die Noise-Helfer können vorerst bleiben (ungenutzt) oder entfernt werden.
2. **Nearest-Neighbour statt bilinear für Prognose**: In den Sample-Funktionen für Prognose-Frames auf gerundete Gitterindizes umstellen (`Math.round`), statt zwischen vier Nachbarn zu interpolieren. Dadurch entstehen exakte Modellblöcke mit harten Stufen; Radarmessung und Morph-Zwischenbilder bleiben bilinear, damit die Animation flüssig bleibt.
3. **Restglättung für Prognose entfernen**: `smoothEdge` bzw. `ensureSmooth` für Prognose-Frames überspringen, damit Spitzen und Farbstufen unverfälscht bleiben.
4. **Upscaling hart**: Beim `drawImage` des Prognose-Offscreens `imageSmoothingEnabled = false` setzen, damit die Blöcke beim Vergrössern nicht verwischen.
5. **Cache-Key anpassen**: Der bestehende Frame-Canvas-Cache-Key wird um das neue Rendering-Flag ergänzt, damit alte gewarpte Kacheln nicht weiterverwendet werden.

Nicht Teil der Änderung: Ingest-Skripte, Farbskala (`SCALE`), Zeitraster, Summenkarte, Radarmessung.

## Erwartetes Ergebnis

Prognose-Zellen erscheinen als scharfe, blockige Modellpixel mit klar getrennten Farbstufen — dieselbe Optik wie im Screenshot. Die Zellgrösse bleibt durch das Ingest-Raster (~3 km/Pixel) bestimmt; die Blöcke werden dadurch deutlich sichtbar.
