## Ziel

Die Kartenkacheln in `src/components/region-map.tsx` von OpenStreetMap auf Esri umstellen. Region-Outline, Wetter-Marker und Update-Logik bleiben unverändert.

## Änderungen

**Nur `src/components/region-map.tsx`:**

Den bestehenden `<TileLayer>` ersetzen durch Esri "World Topo Map" (gut lesbar mit Orts- und Geländedetails, passt zu einer Wetterkarte):

```tsx
<TileLayer
  attribution='Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, FAO, NOAA, USGS'
  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
  maxZoom={19}
/>
```

## Offene Frage

Esri bietet mehrere kostenlose Basemaps. Welche soll ich verwenden?

- **World Topo Map** — topografisch, Höhenlinien, Orte gut sichtbar (Standardvorschlag, passt zu Wetter)
- **World Imagery** — Satellitenbild
- **World Street Map** — klassische Strassenkarte
- **World Gray Canvas** — dezent grau, lässt Wetter-Marker stark hervorstechen

Falls keine Rückmeldung: ich nehme **World Topo Map**.
