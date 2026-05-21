## Ziel
Karte schöner fokussieren, Marker vereinfachen (nur Min/Max) und in Markenfarbe `#2561a1`, neuen Ort Uttwil ergänzen, und beim Klick auf einen Marker eine detaillierte Prognose für den Ort öffnen.

## Änderungen in `src/components/region-map.tsx`

### 1. Zoom & Fokus
- `minZoom: 12 → 13`, `maxZoom: 14 → 15`.
- `boundsOptions.padding: [12,12] → [24,24]` damit alle Spots inkl. Bodensee-Rand sauber im Bild liegen.
- `bounds` zusätzlich um `+0.005` in Süd/West/Ost leicht erweitern, damit Horn/Münsterlingen nicht am Rand kleben.

### 2. Aussenmaske dunkler, Relief in Region markanter
- `OUTSIDE_MASK`: `fillColor: "#8a96a0"`, `fillOpacity: 0.7` (deutlich gedämpfter Aussenbereich).
- `REGION`-Innenfläche: `fillColor: "#a8cf95" → "#b8d9a3"`, `fillOpacity: 0.55 → 0.28` → Relief-Hillshade kommt viel stärker durch.
- Zusätzlicher zweiter `TileLayer` über dem Hillshade nur innerhalb der Region-Clip-Wirkung nicht möglich → stattdessen Region-Layer-Opacity senken (siehe oben) + Hillshade `opacity: 1.0`.
- Region-Outline: `weight: 1.5 → 2`, `opacity: 0.7 → 0.9`, `color: "#2561a1"` (passend zur Markenfarbe).

### 3. Neuer Ort
- `SPOTS` ergänzen: `{ id: "uttwil", name: "Uttwil", lat: 47.5944, lon: 9.3408 }`.

### 4. Marker (Pill) — Farbe, Inhalt, Grösse
- Hintergrund-Pill: `#1f4a7a → #2561a1`.
- **Nur** Min/Max-Badges anzeigen — aktuelle Stunden-Temperatur entfernen.
- Min-Badge: `bg #cfe1f2`, `color #2561a1`. Max-Badge: `bg #0d3563`, `color #fff`.
- Icon-Kreis 44 → 52 px, Icon 32 → 38 px.
- Stadtname: 14 → 15 px.
- Badges: 11 → 13 px, Padding `2px 7px → 3px 9px`.
- `iconSize: [180,64] → [200,72]`, `iconAnchor: [100,36]`.

### 5. Tages-Umschalter
- Statt 6 gleichberechtigter Buttons: segmentierter Umschalter (Pill-Group):
  - Container `bg-muted rounded-full p-1 flex gap-1`.
  - Pro Tag ein Pill-Button `rounded-full px-4 py-2`, aktiv `bg-[#2561a1] text-white shadow`, sonst `text-foreground hover:bg-muted-foreground/10`.
  - Label kompakt: `Heute` / `Morgen` / `Sa 24.5.`.

### 6. Stunden-Slider entfernt
- Da nur noch Tages-Min/Max im Marker steht, wird der 3-Stunden-Slider entfernt (er hatte nur Bedeutung für die Stunden-Temperatur).
- `hourStep`-State, `HOUR_STEPS`, `Slider`-Import und der ganze Slider-Block raus.
- `SpotMarker` nimmt nur noch `dayIndex` und liest `daily.weathercode[dayIndex]`, `daily.temperature_2m_min/max[dayIndex]`.

### 7. Klick auf Marker → Detail-Sheet
- Neuer State `selectedSpot: Spot | null` in `RegionMap`.
- `SpotMarker` erhält `onClick` und nutzt `eventHandlers={{ click: () => onClick(spot) }}`.
- Neue Komponente `SpotDetailSheet` (im selben File) mit shadcn `Sheet` (`side="right"`, `className="w-full sm:max-w-md overflow-y-auto"`):
  - Header: Ort + Datum (aktiver Tag).
  - 6-Tagesliste: pro Tag Datum, Wettersymbol (`weathercode`), Min/Max, Niederschlagswahrscheinlichkeit, Wind — gleiche Struktur wie der ursprünglich geplante Detail-Block im `WeatherWidget`, aber kompakt im Sheet.
  - Stunden-Liste für den aktiven Tag (alle 3 h): Zeit, Symbol, Temperatur, Niederschlag mm.
- Datenquelle: gleiche `fetchForecast(spot.lat, spot.lon)` via `useQuery` mit `queryKey: ["map-weather", spot.id]` (kein Doppel-Fetch).

### 8. Bodensee & Restliches
- `LAKE`-Style unverändert.
- `MapContainer`-Hintergrund unverändert (`#e8edef`).

## Technische Details
- shadcn `Sheet` ist im Projekt vorhanden (`src/components/ui/sheet.tsx`).
- Keine Änderungen an `weather.ts`, GeoJSON-Daten, Routing.
- Datei betroffen: nur `src/components/region-map.tsx`.

## Offen
Wenn dir das Aussen-Grau (`#8a96a0`, 0.7) zu dunkel/zu hell ist, justiere ich Farbe oder Opacity (0.55–0.8) nach.
