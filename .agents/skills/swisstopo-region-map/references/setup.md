# Setup & Anpassungen

## GeoJSON beschaffen

Quellen für Schweizer Polygone:

- **Bundesgeodaten (Swisstopo)** — Gemeinde-/Bezirks-/Kantonsgrenzen unter <https://www.swisstopo.admin.ch/de/landschaftsmodell-swissboundaries3d> (Download als Shapefile, mit `mapshaper.org` zu GeoJSON konvertieren und vereinfachen).
- **geo.admin.ch API** — direkter GeoJSON-Export einzelner Features via <https://api3.geo.admin.ch/services/sdiservices.html#featuresearch>.
- **geojson.io** — von Hand zeichnen für ad-hoc Regionen.

Empfehlung: GeoJSON mit `mapshaper -simplify 5%` verkleinern, bevor es ins Repo kommt. Die Komponente verkraftet 100 KB+ ohne Probleme, aber Bundle-Grösse bleibt schlanker.

Format: `FeatureCollection` mit `Polygon` oder `MultiPolygon` Features. Die Aussen-Maske berücksichtigt sowohl `Polygon` als auch `MultiPolygon` automatisch.

## Bounds anpassen

Standardmässig berechnet die Komponente `maxBounds` aus den Region-Bounds + 0.001° Puffer, dann nochmals `.pad(0.3)`. Falls die Karte zu stark einschnappen soll:

```tsx
// in region-map-template.tsx anpassen
maxBounds: extended.pad(0.5),  // mehr Spielraum
```

Oder ganz weglassen (User kann frei pannen):

```tsx
<MapContainer
  /* maxBounds entfernen */
  /* maxBoundsViscosity entfernen */
>
```

## Eigene Layer einfügen

Alles innerhalb `<SwisstopoRegionMap>...</SwisstopoRegionMap>` wird als react-leaflet Children durchgereicht. Funktioniert für:

- `<Marker>` / `<CircleMarker>` / `<Circle>`
- `<Polyline>` / `<Polygon>`
- `<GeoJSON>` (eigene Layer)
- `<LayersControl>` / `<TileLayer>` (zusätzliche Basiskarten)
- Custom Hooks via `useMap()` in Wrapper-Komponenten

## Custom Marker-Icons (Beispiel)

```tsx
import L from "leaflet";
import { Marker } from "react-leaflet";
import { renderToStaticMarkup } from "react-dom/server";

const icon = L.divIcon({
  html: renderToStaticMarkup(
    <div style={{ background: "#2561a1", color: "#fff", padding: "6px 12px", borderRadius: 999, fontWeight: 700 }}>
      Mein Spot
    </div>
  ),
  className: "",
  iconSize: [120, 28],
  iconAnchor: [60, 14],
});

<SwisstopoRegionMap region={region}>
  <Marker position={[47.5, 9.3]} icon={icon} eventHandlers={{ click: () => alert("hi") }} />
</SwisstopoRegionMap>
```

## Performance

- Relief-Tiles sind PNG mit transparenten Kanälen — bei Mobile/Slow-Net `reliefOpacity={0}` oder Layer ganz weglassen.
- Für >50 Marker `react-leaflet-cluster` (`bun add react-leaflet-cluster`) verwenden.
- GeoJSON-Layers haben `interactive={false}`, damit Klicks durch die Region auf Marker durchgehen. Falls die Region selbst klickbar sein soll, `interactive={true}` setzen und `onEachFeature` ergänzen.

## SSR / Hydration

Die Komponente schützt sich via `mounted` State-Flag — Leaflet greift in `useEffect` aufs `window` zu. Bei TanStack Start / Next.js / Remix kann zusätzlich die Route auf `ssr: false` gesetzt werden, um die initiale Bundle-Last zu reduzieren:

```tsx
// TanStack Start
export const Route = createFileRoute("/karte")({
  ssr: false,
  component: KartePage,
});
```

## Branding

Default-Farben passen zu einem dezenten "Wetter/Tourismus"-Look. Für anderes Branding einfach die Props überschreiben:

```tsx
<SwisstopoRegionMap
  regionStrokeColor="#b91c1c"
  regionFillColor="#fca5a5"
  regionFillOpacity={0.35}
  outsideOpacity={0.75}
/>
```

## Attribution

Swisstopo-Lizenz verlangt Quellenangabe. Default-Attribution ist im `TileLayer` gesetzt:

```
© swisstopo, © OpenStreetMap contributors
```

Beim Entfernen oder Überschreiben darauf achten, diese Zeile (oder Äquivalent) sichtbar zu halten — sonst Lizenzverstoss.
