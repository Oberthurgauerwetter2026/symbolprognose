## Prognose als Iso-Band-Konturen (Referenzbild-Stil)

Nur `PrecipOverlay` in `src/components/maps/radar-map.tsx`. Messung (PNG) bleibt unberührt.

1. Prop `pixelated` → `contour` umbenennen (eine Aufrufstelle).
2. **Sampling bilinear** (kein Nearest-Neighbor) → glatte Kurven zwischen Gridzellen.
3. **`ctx.imageSmoothingEnabled = true`** + `canvas.style.imageRendering = "auto"` → keine harten Pixel.
4. **Farbe weiterhin `colorFor`** (diskrete Stufen) statt `colorForSmooth` → sichtbare Bänder mit klaren Übergängen.
5. **Filter `blur(0.8px) contrast(2.2)` → `contrast(1.4)` ohne Blur** für `contour` → schärfere, aber nicht künstliche Bandkanten.
6. **Off-Screen-Buffer prüfen**: falls Sub-Grid-Upscale zu niedrig (Treppen statt Kurven), Buffer-Auflösung mindestens 4× pro Grid-Zelle in jede Richtung, dann per `drawImage` weichgezogen.
7. Aufruf: `contour={currentFrame.source !== "radar"}`.

Snow-Farben unverändert.