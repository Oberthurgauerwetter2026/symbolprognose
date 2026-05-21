---
name: swisstopo-region-map
description: Reusable Swiss region map component using swisstopo "leichte Basiskarte" tiles, swissALTI3D relief shading, a highlighted region polygon, a grey outside mask, and an optional lake overlay. Use when building a Swiss regional Leaflet/React-Leaflet map (canton, district, lake area) where the inside should pop and the surroundings should be dimmed.
---

# Swisstopo Region Map

Drop-in `<SwisstopoRegionMap />` React component for a swisstopo-styled regional map. The component handles:

- swisstopo **leichte Basiskarte** as base tiles (CH-only, retina-friendly).
- swisstopo **swissALTI3D Reliefschattierung** as an opacity-tunable relief overlay.
- A **region GeoJSON** rendered as a coloured polygon.
- An automatic **outside mask** (world polygon with region + lake punched out) to grey out everything outside the area of interest.
- Optional **lake GeoJSON** rendered as a blue layer beneath the region outline.
- Sensible Leaflet defaults: `maxBounds` from the region, `minZoom 9`, `maxZoom 17`, scroll-wheel zoom, top-right zoom control, SSR guard.

Markers and additional layers are passed via `children` (any `react-leaflet` element works).

## When to use

- Building a Swiss-specific map (canton, district, region, lake area).
- You want the swisstopo cartographic style (clean, hill-shaded, German labels).
- You need the surrounding area visually dimmed so the region stands out.

Do **not** use for global maps or non-Swiss areas (swisstopo tiles only cover Switzerland and a small border zone).

## Setup

1. Install dependencies:

   ```bash
   bun add leaflet react-leaflet
   bun add -d @types/leaflet @types/geojson
   ```

2. Copy the template into the project:

   ```
   assets/region-map-template.tsx  →  src/components/region-map.tsx
   ```

3. Provide region (and optionally lake) GeoJSON as `FeatureCollection`. Example files are in `assets/region.example.json` and `assets/lake.example.json` (Oberthurgau / Bodensee). Replace them with your own — easiest source: <https://api3.geo.admin.ch/services/sdiservices.html> or hand-drawn polygons via geojson.io.

4. Import and use:

   ```tsx
   import { SwisstopoRegionMap } from "@/components/region-map";
   import region from "@/data/region.json";
   import lake from "@/data/lake.json";
   import { Marker, Popup } from "react-leaflet";
   import type { FeatureCollection } from "geojson";

   export function MapPage() {
     return (
       <SwisstopoRegionMap
         region={region as unknown as FeatureCollection}
         lake={lake as unknown as FeatureCollection}
         zoom={11}
         height={600}
       >
         <Marker position={[47.5, 9.3]}>
           <Popup>Mein Marker</Popup>
         </Marker>
       </SwisstopoRegionMap>
     );
   }
   ```

## Props

| Prop                 | Default     | Beschreibung                                       |
| -------------------- | ----------- | -------------------------------------------------- |
| `region`             | —           | `FeatureCollection` — Pflicht.                     |
| `lake`               | —           | Optionaler See als `FeatureCollection`.            |
| `regionStrokeColor`  | `#2561a1`   | Outline-Farbe der Region.                          |
| `regionFillColor`    | `#7ebd5a`   | Füllfarbe der Region.                              |
| `regionFillOpacity`  | `0.55`      | Region-Transparenz.                                |
| `outsideOpacity`     | `0.6`       | Graue Aussen-Maske.                                |
| `reliefOpacity`      | `0.65`      | Stärke der Reliefschattierung.                     |
| `zoom`               | `11`        | Start-Zoom (9–17 sinnvoll).                        |
| `height`             | `600`       | CSS-Höhe (Zahl = px).                              |
| `className`          | —           | Klasse auf dem Wrapper-`<div>`.                    |
| `children`           | —           | Eigene `react-leaflet`-Layer/Marker.               |

## Attribution

Swisstopo verlangt Quellenangabe. Die Komponente fügt automatisch `© swisstopo, © OpenStreetMap contributors` als Tile-Attribution ein. Bei eigener Attribution-Steuerung diese Zeile beibehalten.

## Weiterführend

Siehe `references/setup.md` für detaillierte Anpassungen (Bounds, Custom-Layer, Performance-Tipps).
