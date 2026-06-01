## Änderung in `src/components/maps/precip-accum-map.tsx`

Heatmap transparenter, damit Relief und Grenzen besser durchscheinen:

- `ImageOverlay opacity` von `0.95` → `0.7`.
- swisstopo-Relief-Tile `opacity` von `0.7` → `0.85` (kräftigeres Relief).
- Trennlinien-Alpha im Heatmap-Bitmap anpassen, damit sie bei der niedrigeren Overlay-Opacity noch erkennbar bleiben: dunkel `130 → 180`, hell `150 → 210`.

Klassenfarben-Alpha (255) und Klassengrenzen bleiben unverändert — nur die Gesamt-Mischung mit dem Hintergrund wird leichter.

## Verifikation

- `/intern/niederschlag` öffnen → Reliefschattierung und Schweiz-/Thurgau-Linie deutlich sichtbar, Klassenbänder weiterhin klar lesbar.
- Download-PNG übernimmt die neuen Opacities (DOM-Snapshot).

überall Quelle: Oberthurgauer Wetter