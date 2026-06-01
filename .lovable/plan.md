## Änderung in `src/components/maps/precip-accum-map.tsx`

Die Klassenkanten wirken aktuell pixelig, weil das Heatmap-PNG per `image-rendering: crisp-edges` ohne Browser-Smoothing skaliert wird.

- `image-rendering`-Style auf `.leaflet-image-layer` **entfernen** (Style-Tag löschen). Browser interpoliert dann beim Hochskalieren wieder bilinear → weiche, runde Klassengrenzen.
- Damit die Trennlinien beim Smoothing nicht ausgewaschen wirken, Border-Alpha leicht anheben: dunkel `180 → 210`, hell `210 → 235`.
- `UP` bleibt bei `16` (gute Auflösung als Smoothing-Basis).

## Verifikation

- `/intern/niederschlag`: Klassenkanten erscheinen weich und gerundet, keine Treppen-Pixel mehr, Bänder bleiben klar getrennt.
- Download-PNG übernimmt das Erscheinungsbild (DOM-Snapshot).