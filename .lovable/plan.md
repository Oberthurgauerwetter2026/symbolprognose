Der Farb-Layer in der Windkarte wird aktuell zu stark geglättet. Ursache ist das Canvas-Rendering im `WindColorOverlay` (`wind-map.tsx`):

- `STEP = 3`: Das Off-screen-ImageData wird nur in jedem 3. Pixel berechnet.
- `ctx.imageSmoothingEnabled = true` + `ctx.imageSmoothingQuality = "high"`: Das Canvas upscaled das Low-Res-Buffer bilinear, was den weichgewaschenen Look erzeugt.

Ziel: weniger Glättung, sichtbar schnellere Farbübergänge.

Änderungen:
1. `STEP` von `3` auf `2` reduzieren.
2. `ctx.imageSmoothingEnabled` auf `false` setzen (bzw. `imageSmoothingQuality` entfernen).

Resultat: Der Wind-Farb-Layer wird deutlich weniger weichgewaschen und behält schärfere Kanten zwischen den Farbbändern, ähnlich wie beim Radar-Layer (wo `STEP = 2` + `imageSmoothingEnabled = false` durch den CSS-Filter ersetzt wird).