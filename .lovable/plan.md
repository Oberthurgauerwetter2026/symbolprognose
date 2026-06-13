
# Partikel-Flow sichtbarer

Aktuell zu zart: Alpha 0.55, Strichbreite 1.1 px, Trail-Fade 0.10, Dichte ~viewport/5500.

## Änderungen in `src/components/maps/wind-map.tsx` (WindParticleLayer)

1. **Strichfarbe heller mit dunklem Halo**: Erst kurzen dunklen Stroke (`rgba(20,30,55,0.45)`, `lineWidth 2.2`) zeichnen, dann weissen Kern (`rgba(255,255,255,0.95)`, `lineWidth 1.4`) darüber. Sorgt für klaren Kontrast über blauem wie gelb/rotem Farb-Layer.
2. **Längere Trails**: Trail-Fade von `0.10` → `0.06` (Linien bleiben länger sichtbar, „streaks" statt Punkte). `lineCap = "round"`.
3. **Mehr Partikel**: Dichte-Divisor `5500` → `3200`, `zoomFactor`-Untergrenze `0.5` → `0.7`.
4. **Etwas mehr Speed-Headroom**: `MAX_STEP` von `1.5` → `2.2` px/Frame, damit Bewegung deutlicher wird, ohne hektisch zu werden.

## Was bleibt

- Algorithmus, Sampler, Reseed-Logik, Reduced-Motion-Guard, Trail-Compositing-Trick unverändert.
- Farb-Layer, Pfeile, Tooltip unverändert.
