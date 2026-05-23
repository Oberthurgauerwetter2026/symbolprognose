
## Ziel

Beim Hineinzoomen in die Region-Karte sollen drei zusätzliche Orte mit der gleichen Symbolprognose-Pille erscheinen wie die bestehenden 5 Spots:

- **Hauptwil** (~47.5167, 9.1667)
- **Langrickenbach** (~47.5833, 9.2333)
- **Egnach** (~47.5444, 9.3833)

Beim Herauszoomen verschwinden sie wieder, damit es nicht zu voll wird.

## Umsetzung

### 1. `src/data/spots.ts`
- Spot-Typ um optionales `minZoom?: number` erweitern.
- Drei neue Einträge mit `minZoom: 12` (Hauptwil, Langrickenbach, Egnach) hinzufügen. Bestehende 5 Spots bleiben ohne `minZoom` (immer sichtbar).

### 2. `src/components/region-map.tsx`
- Im `RegionMap` aktuellen Zoom-Level in State halten (`const [zoom, setZoom] = useState(11)`).
- Kleine Helfer-Komponente innerhalb des `MapContainer` (mittels `useMap` + `useMapEvents` aus `react-leaflet`), die bei `zoomend` `setZoom(map.getZoom())` aufruft.
- Beim Rendern der Marker `SPOTS.filter(s => !s.minZoom || zoom >= s.minZoom).map(...)`.
- Alle anderen Marker-Eigenschaften (Pille, mode, dayIdx, absoluteHour, isDay, onClick → goHome, Datenabfrage via React Query) bleiben identisch.

## Verhalten

- Standard-Zoom 11 → wie bisher 5 Spots.
- Ab Zoom 12 (einmal hineinzoomen) → zusätzlich die 3 neuen Spots mit identischer Pille/Logik.
- Daten werden via `fetchForecast(lat, lon)` pro neuem Spot geladen und mit den bestehenden 30-Min-Cache-Settings gespeichert.
