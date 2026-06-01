## Änderung in `src/components/maps/precip-accum-map.tsx`

In `renderHeatmapDataUrl` nach dem `ctx.putImageData(...)` einen Weichzeichnungs-Pass ergänzen:

- Off-Screen-Canvas gleicher Größe anlegen, Original-Bitmap mit `ctx.filter = "blur(2px)"` darauf zeichnen.
- Den geblurrten Inhalt zurück auf das Haupt-Canvas zeichnen.
- Border-Alpha leicht erhöhen (dunkel `210 → 230`, hell `235 → 250`), damit Trennlinien durch den Blur nicht verschwinden.

Effekt: Klassenkanten werden zusätzlich zur Browser-Bilinear-Skalierung an der Bitmap-Quelle weichgezeichnet → sichtbar rundere, weichere Übergänge.

## Verifikation

- `/intern/niederschlag` → Heatmap-Bänder mit weichen, gerundeten Übergängen, Trennlinien bleiben erkennbar.
- Download-PNG zeigt denselben Look.