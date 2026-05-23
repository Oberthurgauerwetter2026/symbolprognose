Die Karte auf Mobile so anpassen, dass sie wie im Screenshot wirkt: stärker auf die Region herangezoomt, größere Höhe, Marker-Pills dürfen am linken/rechten Rand leicht angeschnitten sein.

Änderungen nur in `src/components/region-map.tsx`:

1. **Mobile-Höhe erhöhen** — den Karten-Wrapper auf Mobile von `h-[420px]` auf `h-[560px]` setzen (Desktop bleibt `sm:h-[600px]`).
2. **Stärkerer Zoom durch engere Bounds** — den Puffer in `regionBounds` reduzieren (von ±0.01/±0.02 auf ~±0.002), sodass `fitBounds` näher an die Region heranzoomt.
3. **Kleinere fitBounds-Padding** — `padding: [16, 16]` auf `[4, 4]` reduzieren, damit Leaflet die Region maximal ausnutzt.

Wochentags-Pills, Slider und alle anderen Bereiche bleiben unverändert.