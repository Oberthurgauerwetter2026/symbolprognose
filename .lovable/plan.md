## Ziel

Die Niederschlags-Prognose zeigt immer noch wahrnehmbare Ecken/Stufen an den Iso-Kanten. Der bisherige Blur (1.2 px) und das 2-px-Raster reichen nicht — die Konturen sollen vollständig rund/elliptisch wirken.

## Änderungen

Datei: `src/components/maps/radar-map.tsx`, Funktion `PrecipOverlay` (contour-Modus).

1. **Stärkerer Soft-Blur**
   - CSS-Filter im contour-Modus: `contrast(1.1) blur(3px)` (statt `blur(1.2px)`). Das verschmiert die Treppen vollständig in geschwungene Kanten.
   - Messung-Modus unverändert (`contrast(1.1)`, kein Blur).

2. **Gröberes Sample-Raster + starkes bilineares Upscaling**
   - `STEP` im contour-Modus von `2` auf `4` erhöhen. Weniger Sample-Punkte, dafür wird per `imageSmoothingEnabled=true` auf hohe Qualität hochskaliert — das ergibt von Natur aus runde Iso-Konturen statt Pixel-Kanten.
   - Messung-Modus bleibt bei `STEP=2`.

3. **Zusätzlicher Canvas-Blur beim Upscaling** (optional, falls CSS-Blur alleine zu „milchig" wirkt)
   - Vor dem `drawImage` im contour-Modus: `ctx.filter = "blur(1px)"`, danach `ctx.filter = "none"`. Das verteilt die Farben schon beim Hochskalieren weicher.

4. **fBm-Modulation unverändert** — sorgt weiter für ellipsenartige, unregelmässige Felder.

Keine anderen Karten betroffen.

## Verifikation

- Build/TypeCheck grün.
- Prognose-Frames in `/karten/radar`: Konturen wirken vollständig geschwungen/elliptisch, keine sichtbaren Ecken oder Treppenstufen.
- Farbskala und Intensitäts-Verteilung bleiben erkennbar (kein zu starkes Verwaschen der Kerne).
