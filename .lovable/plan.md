## Problem

Die äusseren Bandgrenzen der Prognose-Niederschlagsfelder zeigen weiterhin gerade Kanten / Ecken. Ursache: das fBm-Noise hat nur 3 Oktaven mit niedriger Basisfrequenz (`*0.6`) und ein **achsparalleles Integer-Gitter**. Die anisotrope Skalierung verschiebt die Lobi zwar, dreht das Gitter aber nicht — an der Aussenkante (wo `v*mod` knapp `minV` unterschreitet) bleibt die Lattice-Geometrie sichtbar als Kanten.

## Plan

Nur `src/components/maps/radar-map.tsx`, Prognose-Branch in `PrecipOverlay`:

1. **Noise-Gitter rotieren** (≈30°), bevor fBm gesampelt wird → die Lattice-Kanten liegen nicht mehr horizontal/vertikal und „verschwinden" optisch in den organischen Lobi.
2. **Höhere Basisfrequenz + mehr Oktaven**: fBm von 3 → 5 Oktaven, Basisfrequenz von `0.6` → `0.9`, damit am Aussenrand feine Wellung statt einer langen geraden Kante entsteht.
3. **Domain-Warp**: vor dem finalen fBm-Sample werden die Koordinaten mit einem zweiten, niederfrequenten fBm verzerrt (`x' = x + w*fbm(x,y)`, analog `y'`). Das ist die Standard-Technik gegen sichtbare Lattice-Grenzen und erzeugt verdrehte, organische Aussenkonturen.
4. Modulator-Range und alles übrige bleiben gleich; **keine Farbglättung**, Pixel-Rendering bleibt.

## Verifikation

Visuell in `/karten/radar` auf Prognose-Frames: Aussenkante der Bänder ist gewellt/zerklüftet, keine geraden Segmente oder Ecken mehr.
