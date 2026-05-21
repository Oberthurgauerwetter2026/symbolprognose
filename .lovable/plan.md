## Ziel

Die Basis-Karte (Swisstopo-Tiles + Relief, Region-Polygon, See, Aussen-Maske, Leaflet-Konfiguration) — **ohne** Wetter-Marker, Slider, Tagesleiste und Forecast-Logik — als wiederverwendbare Vorlage speichern, sowohl als:

1. **Skill** unter `.agents/skills/swisstopo-region-map/` (in zukünftige Projekte via `skills--apply_draft` übernehmbar).
2. **Vorlage-Datei** im aktuellen Projekt unter `src/components/region-map-template.tsx` + `src/data/region.json` / `lake.json` (bleibt verfügbar; kann manuell kopiert werden).

## 1. Template-Komponente — `src/components/region-map-template.tsx`

Schlanke, eigenständige Komponente `<SwisstopoRegionMap />` mit:

- Props: `region: FeatureCollection`, `lake?: FeatureCollection`, `regionColor?: string`, `outsideOpacity?: number`, `reliefOpacity?: number`, `zoom?: number`, `height?: string | number`, `children?: ReactNode` (für eigene Marker/Layer).
- Setup:
  - `MapContainer` mit `center` (aus Region-Bounds), `zoom` default 11, `maxBounds` aus erweiterten Region-Bounds + Padding, `minZoom: 9`, `maxZoom: 17`, `scrollWheelZoom`, `zoomControl: false`, `attributionControl: true`, Hintergrund `#e8edef`.
  - `TileLayer` Swisstopo `leichte-basiskarte`.
  - `TileLayer` Swisstopo `swissalti3d-reliefschattierung`, opacity konfigurierbar (default 0.65).
  - `GeoJSON` Aussen-Maske (Welt-Polygon minus Region/See) — grau.
  - `GeoJSON` See — blau (optional).
  - `GeoJSON` Region — BRAND-Farbe + grünliche Füllung (konfigurierbar).
  - `ZoomControl` rechts oben.
  - `{children}` Slot innerhalb `MapContainer` für eigene Marker.
- SSR-Schutz: `mounted`-State mit `useEffect`.
- Keine Abhängigkeit von `react-query`, `weather-icons`, Slider oder anderen App-spezifischen Modulen.

## 2. Skill — `.agents/skills/swisstopo-region-map/`

```
.agents/skills/swisstopo-region-map/
├── SKILL.md
├── references/
│   └── setup.md
└── assets/
    ├── region-map-template.tsx
    ├── region.example.json
    └── lake.example.json
```

### `SKILL.md` (frontmatter + body)

- `name: swisstopo-region-map`
- `description: Reusable Swiss region map using swisstopo leichte-basiskarte tiles, swissALTI3D relief shading, region polygon with outside mask, and lake overlay. Use when building Swiss regional maps with Leaflet/React-Leaflet.`
- Body: Übersicht, Abhängigkeiten (`leaflet`, `react-leaflet`, `geojson` types), Setup-Schritte (npm install, Datei kopieren, GeoJSON bereitstellen), Verwendung mit Code-Snippet, Hinweis auf swisstopo-Attribution.

### `references/setup.md`

Detaillierte Installations- und Anpassungsanleitung (Bounds erweitern, Custom Layer einfügen, Marker via children).

### `assets/region-map-template.tsx`

Kopie der Template-Komponente.

### `assets/region.example.json` / `lake.example.json`

Aktuelle Region/See-GeoJSONs als Beispiel (Bodensee-Region).

## 3. Aktivierung

Nach Erstellung `skills--apply_draft` mit `.agents/skills/swisstopo-region-map` aufrufen.

## Unangetastet

`src/components/region-map.tsx` (bestehende Wetter-Karte) bleibt unverändert.
