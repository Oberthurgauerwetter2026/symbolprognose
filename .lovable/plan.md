## Ziel

Die Niederschlagsklassen sollen kräftiger wirken und sauber voneinander getrennt sein — wie auf Radar-Klassenkarten (Kachelmann/MeteoSchweiz).

## Änderungen in `src/components/maps/precip-accum-map.tsx`

### 1. Farben kräftiger

- Pixel-Alpha in `colorForAccum` von `0.86` → `1.0` (volle Deckkraft pro Klassenfarbe).
- `ImageOverlay opacity` von `0.85` → `0.95` (Relief minimal durchscheinend, damit Topographie noch leicht erkennbar bleibt, aber Farben nicht mehr verwaschen).
- swisstopo-Tile `opacity` bleibt `0.7` (Relief bleibt subtil im Hintergrund).

### 2. Dünne Trennlinien zwischen Klassen

In `renderHeatmapDataUrl` zweiter Pass nach dem Pixel-Fill:
- Pro Pixel die Klassen-Indices der vier Nachbarn (rechts, unten) vergleichen.
- Falls sich der Klassen-Index ändert, das Pixel als „Border" markieren.
- Border-Farbe **adaptiv** je nach Helligkeit der dunkleren Nachbarklasse:
  - Klassen 0–4 (helle Blau-/Grüntöne, mm < 20) → Border `rgba(15,23,42,0.55)` (dunkel).
  - Klassen 5–9 (Gelb/Orange/Rot/Magenta/Violett, mm ≥ 20) → Border `rgba(255,255,255,0.7)` (hell).
- Border-Stärke: 1 Pixel im Upsample-Raster (`UP=8`), also visuell ein feiner Strich.

Implementation: Klassen-Index-Array `clsIdx: Int8Array(w*h)` aufbauen (–1 wenn unter Schwelle). Dann in zweitem Loop: wenn `clsIdx[x,y] !== clsIdx[x+1,y]` oder `!== clsIdx[x,y+1]`, dann den helleren Nachbar überschreiben mit Border-Farbe (entscheidet die Trennlinie auf der höheren-mm-Seite, damit die Außenkontur scharf bleibt).

### 3. Export

Der Download nutzt bereits `html-to-image` und snapshottet den gleichen DOM → Änderungen sind automatisch im PNG.

## Verifikation

- `/intern/niederschlag` öffnen → Heatmap zeigt sattere Farben, klare Klassengrenzen.
- Download für 12 h / 24 h / 48 h → identisches Erscheinungsbild.