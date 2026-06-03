## Ziel
In `src/components/maps/precip-accum-map.tsx` die Ortsdarstellung angleichen an die Radar-Karte: keine weissen Tooltip-Pillen, kleines Quadrat statt Punkt, und zoomabhängige Sichtbarkeit (im Default-Zoom nur Hauptorte, beim Reinzoomen weitere).

## Änderungen

1. **Sichtbarkeitslogik**
   - `useMapZoom` + `ZoomGate`-Helper (1:1 wie in `radar-map.tsx`) lokal hinzufügen.
   - Stadt-Liste umstrukturieren:
     - Immer sichtbar (Default-Zoom 9.5): **Bischofszell, Münsterlingen, Amriswil, Horn**
     - Erst ab Zoom ≥ 11: Romanshorn, Erlen, Güttingen
   - Konfiguration analog zu `src/data/spots.ts` über `minZoom`-Feld pro Stadt.

2. **Marker-Stil (Radar-analog, aber Quadrat)**
   - `CircleMarker` + `<Tooltip permanent class="city-label">` (weisse Pille) entfernen.
   - Stattdessen `Marker` mit `L.divIcon` rendern, identische Typografie/Schatten-Logik wie `cityIcon()` in `radar-map.tsx`:
     - Kleines gefülltes Quadrat (≈ 7×7 px, Farbe `#2561a1`, weisser Text-Shadow für Lesbarkeit) statt `•`.
     - Daneben Ortsname in dunkler Schrift mit weissem Text-Shadow (kein Hintergrund-Kasten).
   - `<style>`-Block mit `.leaflet-tooltip.city-label` entfällt.

3. **Imports**
   - `CircleMarker`, `Tooltip` aus `react-leaflet`-Import entfernen, `Marker` ergänzen.
   - `import L from "leaflet"` ergänzen (für `divIcon`).

## Nicht im Scope
- Heatmap-Rendering, Legende, Download-Logik, Karten-Bounds/Zoomstufen bleiben unverändert.
- Andere Karten (Radar, Region, …) bleiben unangetastet.
