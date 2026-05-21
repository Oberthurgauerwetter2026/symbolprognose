## Ziel

Neue Komponente: interaktive OpenStreetMap-Karte mit Umriss der Region (Bezirk Arbon / oberer Thurgau, analog der Beispiel-Karte) und 4 fixen Wetter-Markern in **Horn, Amriswil, Sitterdorf (Zihlschlacht-Sitterdorf) und Münsterlingen**. Jeder Marker zeigt Wettersymbol, Temperatur (°C) und Wind (km/h + Richtungspfeil) für die **aktuelle Stunde** und aktualisiert sich automatisch jede Stunde.

## Technischer Ansatz

**Karten-Library: react-leaflet + leaflet** (gleicher Stack wie "My weather hub").
- OpenStreetMap-Tiles (frei, kein API-Key)
- Region-Umriss als GeoJSON-Polygon-Layer
- Wetter-Marker als `L.divIcon` (custom HTML → Wettericon + Temp + Wind)

**Wetterdaten:** bestehende `fetchForecast()` aus `src/lib/weather.ts` pro Ort einmal abrufen, daraus den Stundenwert für `now` ziehen. Auto-Refresh via `setInterval` zum nächsten vollen Stundenanfang.

**Region-Umriss:** GeoJSON der Gemeinden Bezirk Arbon (+ Münsterlingen aus Bezirk Kreuzlingen) aus dem swissBOUNDARIES3D-Datensatz. Als statisches `src/data/region.geojson` ablegen (einmalig generiert/bereitgestellt). Stil: dünne schwarze Outline, transparente Füllung — wie im Referenzbild.

## Neue / geänderte Dateien

1. **`bun add leaflet react-leaflet @types/leaflet`**
2. **`src/data/region.geojson`** — GeoJSON-FeatureCollection mit Gemeindegrenzen Bezirk Arbon + Münsterlingen
3. **`src/components/region-map.tsx`** — neue Komponente:
   - MapContainer (zentriert auf ~47.55 N, 9.30 E, Zoom 11)
   - TileLayer (OSM)
   - GeoJSON-Layer mit Region-Umriss
   - 4 Marker mit divIcon (Wettericon-Komponente + Temp + Windpfeil)
   - `useQuery` pro Ort (queryKey enthält aktuelle Stunde → automatischer Refetch)
4. **`src/routes/karte.tsx`** — neue Route `/karte` mit eigener `head()` (Title, Description, OG)
5. **`src/components/weather-widget.tsx`** — Link/Tab "Karte" zur neuen Route ergänzen (minimal)
6. **`src/styles.css`** — Leaflet-CSS importieren (`@import "leaflet/dist/leaflet.css"`)

## Marker-Design

Pro Ort eine kleine Card (divIcon):
```
┌──────────────┐
│  ☀  18°C    │
│  → 12 km/h   │
│  Horn        │
└──────────────┘
```
Verwendet bestehendes `src/components/weather-icons/index.tsx` für Symbol-Konsistenz, Ocean-Deep-Palette und Outfit/Figtree.

## Update-Logik

- React-Query-Key: `["map-weather", ortId, currentHourIso]`
- `currentHourIso` wird via `useState` + `setInterval` (alle 60s prüfen, bei Stundenwechsel updaten) gesetzt → automatischer Refetch zur vollen Stunde, ohne Polling-Flut.

## Offene Punkte zur Bestätigung

- **Region-Umfang:** ganzer Bezirk Arbon + Münsterlingen (wie Referenzbild) — oder anderer Zuschnitt?
- **Integration:** als eigene Route `/karte` (verlinkt aus dem Haupt-Widget) — oder als zusätzlicher Tab innerhalb des bestehenden Widgets?
- **Gemeindelabels:** Gemeindenamen wie im Referenzbild auf die Karte (klein, kursiv) — ja/nein?
