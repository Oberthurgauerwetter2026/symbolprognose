## Ziel

Karte auf einen Standardzoom zwischen den beiden Screenshots bringen, Bodensee klar als „Bodensee" beschriften, einen 3‑Stunden‑Zeitschieber mit Wochentag unter der Karte ergänzen, das Detail‑Sheet entfernen und Klicks auf die Region in die Symbolprognose (Index‑Route `/`) weiterleiten.

## Änderungen in `src/components/region-map.tsx`

### 1. Standard‑Zoom (zwischen Screenshot 1 und 2)
- `bounds` weniger stark erweitern: `sw.lat - 0.015`, `sw.lng - 0.02`, `ne.lat + 0.02`, `ne.lng + 0.02` (statt 0.04/0.05).
- `boundsOptions.padding: [40,40] → [24,24]`.
- `minZoom: 10 → 11`, `maxZoom: 15` bleibt.
- `maxBounds: extended.pad(0.3) → extended.pad(0.15)`.
Damit ist die gesamte Region inkl. Bodensee‑Rand sichtbar, aber näher dran als Screenshot 1.

### 2. Bodensee‑Label
- Neue Konstante `LAKE_LABEL_POS = L.latLng(47.625, 9.32)` (Mitte des sichtbaren Bodensee‑Streifens am oberen Kartenrand).
- Zusätzlicher `Marker` mit `divIcon` ohne Hintergrund, nur Text:
  ```
  <span style="font-family:'Figtree';font-style:italic;font-weight:600;
               font-size:18px;color:#1e5a7a;letter-spacing:0.08em;
               text-shadow:0 1px 2px rgba(255,255,255,0.9)">Bodensee</span>
  ```
- `interactive: false`, `iconSize: [140, 24]`, `iconAnchor: [70, 12]`.

### 3. 3‑Stunden‑Zeitschieber unter der Karte
- Neuer State `hourStep: number` (0 = 00:00, 1 = 03:00, … 7 = 21:00), Default 8h heuristisch (aktuelle Stunde / 3 gerundet) für `dayIndex===0`, sonst `4` (12:00).
- Wochentag wird oben links angezeigt: `formatDayLabel(days[dayIndex], dayIndex).top + " " + dateSub(...)`, rechts die gewählte Uhrzeit (`${hourStep*3}:00`).
- Slider via shadcn `Slider` (`min=0`, `max=7`, `step=1`).
- Darunter eine Skala mit 8 Tick‑Labels (`00`, `03`, `06`, `09`, `12`, `15`, `18`, `21`) als `grid-cols-8`.
- `MarkerPill` zeigt zusätzlich zur Tages‑Min/Max auch die Temperatur und das Wettersymbol für den gewählten 3h‑Slot:
  - Index in `hourly`: `dayIndex * 24 + hourStep * 3`.
  - Anzeige: Symbol + `tHour°` als zusätzliches kleines Badge oben rechts in der Pill, Min/Max bleiben darunter.
  Variante (einfacher): nur das Symbol + die Stunden‑Temperatur wechseln, Min/Max bleiben Tages‑Min/Max.

### 4. Detail‑Sheet entfernen
- `SpotDetailSheet`, `DetailContent` und alle `Sheet`‑Imports raus.
- `selectedSpot`‑State raus.
- `SpotMarker.onClick` raus (Marker bleiben rein dekorativ klickbar, ohne Sheet).

### 5. Region‑Klick → `/` (Symbolprognose)
- `useNavigate` aus `@tanstack/react-router` importieren.
- `<GeoJSON data={REGION}>`: `interactive={true}`, `eventHandlers={{ click: () => navigate({ to: "/" }) }}`.
- Style‑Hover‑Effekt: `onEachFeature` setzt `mouseover`/`mouseout` mit `setStyle({ fillOpacity: 0.45 })` ↔ `0.28` und `cursor: pointer` via CSS‑Klasse `region-clickable` auf dem Pfad.
- Kleiner CSS‑Snippet in derselben Datei via `<style>` oder neue Klasse in `src/styles.css` (`.leaflet-interactive.region-clickable { cursor: pointer; }`). Da Leaflet `path` schon `cursor:pointer` setzt, reicht meist `interactive=true`.

### 6. Sonstiges
- `Sheet*`‑Imports, `weatherLabel`, `formatTimeHHMM`, `windDirectionLabel`, `weekdayShort`, `cn` (nur falls ungenutzt) bereinigen.
- `WeatherIcon`, `useQuery` bleiben.

## Nicht geändert
- `src/lib/weather.ts`, GeoJSON, Routen, Markenfarbe `#2561a1`, Tages‑Umschalter (Pill‑Group oberhalb der Karte).

## Offene Punkte
- Soll im 3h‑Slot die Stunden‑Temperatur **zusätzlich** zu Min/Max in der Pill stehen (kompakter Stundenbadge oben rechts) oder die Tages‑Min/Max **ersetzen**? Default im Plan: zusätzlich.
- Bodensee‑Label‑Position 47.625 / 9.32 ist ein Schätzwert nach den Screenshots — bei Bedarf nachjustieren.
