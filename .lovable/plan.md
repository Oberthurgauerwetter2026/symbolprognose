## Ziel

Die Niederschlags-Prognose im Ns-Radar wird aktuell als sichtbar gegriddetes Pixelraster gezeichnet (3-px-Blöcke, nearest-neighbour upscaling, `image-rendering: pixelated`). Das ergibt rechteckige Stufen und 90°-Ecken statt organischer, ellipsenartiger Niederschlagsfelder.

Die fraktale fBm-Modulation, die für unregelmässige Formen sorgt, ist schon vorhanden — nur das "blockige" Rendering überdeckt sie.

## Änderungen

Datei: `src/components/maps/radar-map.tsx`, Funktion `PrecipOverlay` (Prognose-Modus, `contour=true`).

1. **Pixelig → glatt rendern**
   - `cv.style.imageRendering` immer `"auto"` (nicht mehr `"pixelated"` im contour-Modus).
   - `ctx.imageSmoothingEnabled = true` auch im contour-Modus, `imageSmoothingQuality = "high"` → bilineares Upscaling glättet die Stufen zu Kurven.

2. **Feineres Raster**
   - `STEP` im contour-Modus von `3` auf `2` reduzieren. Etwas teurer, aber die Iso-Kanten werden detaillierter und die fBm-Modulation kommt besser zur Geltung.

3. **Leichter Soft-Blur für organische Ränder**
   - CSS-Filter auf dem Canvas erweitern: `filter: "contrast(1.1) blur(1.2px)"` (statt nur `contrast(1.1)`). Sehr dezent — eliminiert Rest-Treppchen, ohne die Farbskala zu verfälschen.
   - Gilt nur im contour-Modus; für die Messungsanzeige bleibt es wie bisher (`contrast(1.1)` ohne Blur), damit die Radar-Pixel scharf bleiben.

4. **fBm-Modulation unverändert**
   - Die Frequenz (`0.6`) und Amplitude (`0.35 + n * 1.3`) bleibt. Damit bleiben die Felder unregelmässig wie Ellipsen mit eingebetteten Kernen — nur ohne Kanten-Aliasing.

Keine Änderungen an Farbskala, Frames, Timeline, Legende, anderen Karten (Wind, Niederschlagssumme).

## Verifikation

- Build/TypeCheck grün.
- Prognose-Frames in `/karten/radar` zeigen geschwungene, ellipsenartige Niederschlagsbänder ohne sichtbare 90°-Ecken.
- Messungs-Frames (Radar) bleiben optisch unverändert (scharf, nicht verwischt).
