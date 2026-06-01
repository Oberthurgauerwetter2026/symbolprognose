## Prognose pixelig rendern (Search.ch-Look)

Nur in `src/components/maps/radar-map.tsx`, Komponente `PrecipOverlay`:

1. Prop `smooth` → `pixelated` umbenennen (eine Aufrufstelle).
2. **Sampling**: bei `pixelated` Nearest-Neighbor statt bilinear — direkt `v00` nehmen, kein `tx/ty`-Mix. Grid-Zellen bleiben als Blöcke sichtbar.
3. **Upscale**: bei `pixelated` `ctx.imageSmoothingEnabled = false` und `canvas.style.imageRendering = "pixelated"`.
4. **Farbe**: bei `pixelated` `colorFor` (diskrete Stufen) statt `colorForSmooth`. Palette unverändert.
5. Aufruf: `pixelated={currentFrame.source !== "radar"}` — nur Prognose betroffen, Messung (PNG-Pfad) bleibt unberührt.

Snow-Farben (`snowColorFor`) und alle anderen Overlays unverändert.