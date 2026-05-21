## Ziel
Karte enger zoomen, Bodensee zeigen, grössere Marker, 6-Tages-Tabs + 3-Stunden-Slider, und Relief-Schummerung sowohl innerhalb als auch ausserhalb der Region.

## Änderungen in `src/components/region-map.tsx`

### 1. Relief als Basis-Layer (innen + aussen)
- `TileLayer` mit Esri „World_Hillshade" als unterste Schicht:
  `https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}`
- Darüber halbtransparente Farb-Overlays via GeoJSON:
  - **Region (innen)**: `fillColor: "#a8cf95", fillOpacity: 0.55` → Grün scheint mit Schummerung durch.
  - **Aussen-Maske**: Welt-Rechteck minus Region als Polygon mit Loch, `fillColor: "#cfd6d9", fillOpacity: 0.45` → gedämpftes Grau, Schummerung bleibt sichtbar.
  - **Bodensee** (`lake.json`): `fillColor: "#7ec8e3", fillOpacity: 0.85`, leichter Rand `#6bb6d6`.
- Region-Outline: `color: "#ffffff", weight: 1.5, opacity: 0.7`.
- `MapContainer`-Hintergrund bleibt als Fallback `#e8edef`.

### 2. Kartenfokus enger
- Bounds aus Region, nördlich um `+0.015` erweitern (Bodensee sichtbar).
- `boundsOptions={{ padding: [12, 12] }}`, `minZoom: 12`, `maxZoom: 14`.
- `maxBounds = bounds.pad(0.15)`, `maxBoundsViscosity: 1.0`.

### 3. Marker-Pill grösser
- Icon-Kreis 30 → 44 px, Icon 22 → 32 px.
- Pill-Padding 5/12 → 8/14, Stadtname 11 → 14 px, Badges 10 → 13 px (Padding `2px 8px`).
- `iconSize: [170, 64]`, `iconAnchor: [85, 32]`.

### 4. 6-Tages-Tabs (über der Karte)
- 6 Buttons (heute … +5). Labels: „Heute" / „Morgen" / `de-CH`-Wochentagskürzel, Subtext `d.M.`.
- Aktiv: `bg-primary text-primary-foreground`, sonst `bg-muted hover:bg-muted/70`.
- State `dayIndex` in `RegionMap`.

### 5. 3-Stunden-Slider (unter der Karte)
- shadcn `Slider`, Werte 0–7 → Stunden 0/3/6/9/12/15/18/21.
- Label „Uhrzeit: 15:00".
- Default: `Math.round(now.getHours()/3)` (nur wenn `dayIndex === 0`).
- State `hourStep` in `RegionMap`.

### 6. Marker-Werte aus Stundendaten
- `SpotMarker` erhält `dayIndex` und `hourStep`.
- Zielzeit: `daily.time[dayIndex] + 'T' + pad(hourStep*3) + ':00'`; Index via `findIndex(t => t.startsWith(target))`.
- Pill zeigt aktuelle Stunden-Temperatur (gross) + Symbol aus `hourly.weathercode[i]`, darunter Tages-Min/Max als kleine Badges.
- QueryKey bleibt `["map-weather", spot.id]` — ein Fetch deckt alle Tage/Stunden.

### 7. Layout
```
[Tabs: Heute | Morgen | Sa | So | Mo | Di]
[Karte 600px]
[Slider 0–21 Uhr, Label "15:00"]
```

## Technische Details
- Aussen-Maske: bestehender Ansatz (Welt-Rechteck `[-180,-85]..[180,85]` mit Region-Polygonen als Löcher) bleibt — nur Farbe/Opacity ändern.
- Esri World_Hillshade ist CORS-frei und kostenlos für Apps mit Attribution; Attribution-Control bleibt deaktiviert wie aktuell.
- Keine Änderungen an `weather.ts` oder GeoJSON-Daten.

## Offen
Keine Rückfrage — wenn dir die Region-Innenfarbe zu hell/dunkel ist, justiere ich die Opacity (`0.35`–`0.7`) nach.
