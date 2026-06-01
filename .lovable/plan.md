## Ziel

Download-PNG zeigt **exakt** denselben Karten-Render wie der Leaflet-View (swisstopo-Relief + Heatmap-Overlay + Seen + Grenzen, gleiche Zoom-Stufe). Header/Legende werden drumherum gemalt.

## Vorgehen

1. **Dependency**: `bun add html-to-image` (DOM→Canvas, klein, hängt nicht von Cleanup-globals ab).
2. **swisstopo CORS**: bereits gesetzt (`access-control-allow-origin: *`). TileLayer um `crossOrigin: "anonymous"` ergänzen, damit `<img>`-Pixel auslesbar bleiben.
3. **`src/components/maps/precip-accum-map.tsx`**:
   - `useRef<HTMLDivElement>` auf den Leaflet-Container (statt `MapContainer key` direkt) — wir hängen einen Wrapper-`<div ref={mapDivRef}>` außen um den `MapContainer`.
   - `download()` ersetzen:
     - `await toCanvas(mapDivRef.current, { cacheBust: true, pixelRatio: 2 })` → `mapCanvas` (echte Map inkl. swisstopo, Heatmap-Overlay, See, Grenzen).
     - Neues Final-Canvas 1280×760 anlegen, Header (Titel + Zeitraum + Max-Chip) und Legende wie bisher zeichnen, dazwischen `ctx.drawImage(mapCanvas, PAD.left, PAD.top, innerW, innerH)`.
     - Bei Tile-Ladefehler/CORS-Fehler Toast „Karte noch nicht vollständig geladen — kurz warten und erneut" zeigen.
   - `renderExportCanvas` (bilineare Heatmap-Rekonstruktion) entfernen — wird nicht mehr gebraucht.
4. **Tile-Ready-Check**: vor `toCanvas` einen kurzen `await new Promise(r => setTimeout(r, 200))` einfügen, damit ausstehende `tileload`-Events durchsind. Alternativ Leaflet-Instanz via `whenReady`/`tilesloaded` abwarten, aber `setTimeout` reicht praktikabel.

## Verifikation

- Download für 12 h / 24 h / 48 h öffnen → Karte sieht 1:1 wie der Screen aus (Reliefschattierung sichtbar, Seen kachelmann-türkis, Heatmap-Banding identisch, Thurgau-Linie identisch).
- Header („+24 h Niederschlagssumme", Zeitraum, Max-Chip) und Legenden-Klassenbar sind unverändert vorhanden.