## Änderungen in `src/components/maps/precip-accum-map.tsx`

### 1. Schärfere Heatmap, feinere Trennlinien

Ursachen der Unschärfe: (a) bilineare mm-Interpolation vor dem Klassieren weicht Bandkonturen auf, (b) Leaflet skaliert das PNG-Overlay mit Browser-Smoothing, (c) Border ist 1 px bei `UP=8` — physisch dünn, aber durch Smoothing weich.

- `UP` von `8` → `16` in `renderHeatmapDataUrl`. Doppelte Auflösung → schärfere Klassenkanten, Border bleibt 1 px (= halb so dick relativ).
- Border-Alpha senken: dunkel `170 → 130`, hell `200 → 150` (feiner, weniger dominant).
- Im JSX einen einmaligen `<style>`-Tag in die Card einhängen, der gezielt `.leaflet-image-layer` (das vom `ImageOverlay` gerenderte `<img>`) auf `image-rendering: crisp-edges` setzt — verhindert Browser-Bilinearsmoothing über die Klassenkanten.

### 2. Farblegende moderner platzieren

- Bisherige Legenden-Sektion unterhalb der Karte (`px-6 py-4 border-t bg-zinc-50/60`) entfernen.
- Neue **Floating-Legende** als Overlay innerhalb des Map-Containers, unten zentriert:
  - Absolute Position `bottom-3 left-1/2 -translate-x-1/2`, `z-[500]` (über Leaflet-Panes).
  - Glass-Look: `bg-white/85 backdrop-blur-md ring-1 ring-zinc-900/10 shadow-lg rounded-full px-3 py-1.5`.
  - Horizontale Farbleiste (10 Klassen, je 18 × 10 px, abgerundet), darüber Klassenlabels (10 px tabular-nums).
  - Kompakt: Gesamtbreite ~360 px, fügt sich harmonisch in den Map-Frame ein.
- Der `<div className="h-[560px] w-full">`-Wrapper bekommt `relative`, damit Absolute-Positionierung funktioniert.

### 3. Download-PNG ohne Header-Button-Bereich

Der Card-Header (Titel + Download-Button) wird aktuell mitgesnapshottet — deshalb taucht der „PNG herunterladen"-Button im PNG auf.

- Im Card-Header dem rechten Button-Container `data-export-exclude` setzen.
- `filter` in `html-to-image` erweitern: `if (node.dataset?.exportExclude !== undefined) return false`.
- Damit verschwindet der Download-Button (und der Hinweistext darunter) aus dem PNG, der linke Titel-Block (Badge „+24 h", „Niederschlagssumme", Max-Zeile) bleibt erhalten.

## Verifikation

- `/intern/niederschlag` → Heatmap zeigt schärfere Klassenkanten und dünnere Trennlinien.
- Floating-Legende sitzt mittig unten auf der Karte, glasig, kompakt.
- Download für 12 h öffnet PNG ohne den „PNG herunterladen"-Button (und ohne Hinweistext).