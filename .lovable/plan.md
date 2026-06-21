## Ziel

Auf der Radar-Karte sehen die **Prognose-Niederschlagsfelder** (Forecast-Layer) aktuell aus wie axis-aligned Rechtecke/Quadrate mit harten 90°-Ecken. Sie sollen wie unregelmässige, organisch geformte Ellipsen wirken — die **harten Farbbänder bleiben aber erhalten** (keine Glättung der Farbskala).

## Ursache

In `src/components/maps/radar-map.tsx` rendert `PrecipOverlay` die Prognose mit:
- `STEP = 3` Bildschirm-Pixel pro Sample → grobes Raster
- Nearest-Neighbour-Upscaling (`imageSmoothingEnabled = false`, `imageRendering: pixelated`)
- fBm-Noise-Modulation auf Grid-Koordinaten

Die Iso-Kanten zwischen Farbklassen verlaufen dadurch entlang dieses 3-px-Rasters → sichtbare horizontale/vertikale Treppen und „quadratische" Ecken.

## Plan

Nur `src/components/maps/radar-map.tsx`, nur die Prognose-Branch (`contour === true`):

1. **Feineres Sample-Raster für die Prognose**
   - `STEP` für Prognose von `3` auf `1` (Messung bleibt `2`).
   - Damit folgt die Iso-Kante pixelgenau dem (noise-modulierten) Wertefeld → geschwungene, organische Bandgrenzen statt 3-px-Treppe.
   - Aufwand pro Frame steigt ~9×, ist aber tragbar (Canvas ist klein, alle 100–200 ms gezeichnet).

2. **Noise stärker an der Form beteiligen**
   - In der fBm-Modulation eine leicht **anisotrope** Komponente einbauen (z. B. `fbm(fxRaw*0.6 + 0.3*fyRaw, fyRaw*0.55 - 0.2*fxRaw)`), damit die Lobi nicht achsparallel ausgerichtet sind → mehr „schiefe Ellipsen".
   - Modulator-Range minimal weiter (z. B. `0.30 … 1.75`), damit Bandgrenzen unregelmässiger wandern.

3. **Pixel-Rendering belassen**
   - `imageSmoothingEnabled = false` und `imageRendering: pixelated` bleiben → **keine Farbglättung**, harte Klassenkanten bleiben erhalten („nicht glätten").

4. **Keine Änderung** an Farbskala, Opazitäten, Snow-Branch, Messungs-Branch, anderen Karten.

## Verifikation

- Build/Typecheck grün.
- Visuell in `/karten/radar` (Prognose-Frames): Felder erscheinen als unregelmässig geformte, gerundete Lobi statt Rechtecken; Farbbänder bleiben scharf abgegrenzt.
