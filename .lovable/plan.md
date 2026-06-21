
# Satellitenanimation (EUMETView WMS)

Neuer Karten-Tab `/karten/satellit` mit professioneller Zeitraffer-Animation, modelliert nach dem bestehenden Radar-Tab. Datenquelle ist der offene EUMETView WMS-Service von EUMETSAT — kein API-Key, kein eigener Ingest, kein Cloud-Worker nötig.

## Regionen (Auswahlmenü)

Standard: **Schweiz** (Bounding-Box ca. 5.5–11.0°E / 45.5–48.0°N, Layer auf Alpen-Subset gezoomt).

| Label                | EUMETView Layer (WMS `LAYERS`)                                                     | Default-Zentrum / Zoom |
|----------------------|-------------------------------------------------------------------------------------|------------------------|
| Schweiz              | `mtg_fd:rgb_truecolor` (MTG FCI True Color, Vollscheibe, Schweiz-Ausschnitt)        | 46.8 / 8.2, z6         |
| Alpen True Colour    | `mtg_fd:rgb_truecolor`                                                              | 46.5 / 10.0, z5        |
| Europa GeoColour     | `mtg_fd:rgb_geocolour` (Fallback: `msg_iodc:rgb_naturalenhncd`)                     | 50 / 10, z4            |
| Europa Infrarot      | `mtg_fd:ir105` (10.5 µm, invertiert, Standard-Colormap)                             | 50 / 10, z4            |
| Global Infrarot      | `mumi:wideareacoverage_ir` (globale IR-Mosaik aus mehreren Geo-Satelliten)          | 20 / 0, z2             |

Beim Wechsel der Region wird `map.flyTo(...)` ausgeführt und die WMS-Layer-URL ersetzt; Animationsindex bleibt erhalten.

## Daten- und Zeit-Logik

`src/lib/satellite.functions.ts` (neue Datei):
- `getSatelliteManifest({ region })` — `createServerFn`, gibt Frame-Liste der letzten 5h zurück.
- Server-seitige Helper berechnen die Frame-Zeitachse (kein Netzwerk-Call nötig):
  - `now` auf nächste 10-Min-Grenze abrunden (MTG FCI publiziert alle 10 min, MSG/IR/Global alle 15 min).
  - Pro Region eigener `stepMinutes`: `mtg_truecolor`/`geocolour` = 10 min, `ir` = 15 min, `global_ir` = 30 min → 30/20/10 Frames für 5 h.
  - Latency-Puffer: aktuelle Zeit minus `latencyMinutes` pro Layer (MTG ~20 min, Global ~45 min), damit der jüngste Frame existiert.
- Rückgabe: `{ region, layer, frames: [{ time: ISO, label: "HH:mm" }], updatedAt }`.
- Caching: 60s in-memory + `Cache-Control: public, max-age=60` Response-Header.

Kein Ingest, kein R2, kein pg_cron — der Browser holt Tiles direkt von `https://view.eumetsat.int/geoserver/wms`.

## Route & Komponenten

```
src/routes/karten.satellit.tsx                neuer Tab, lädt Manifest via useSuspenseQuery
src/components/maps/satellite-map.tsx          Leaflet-Karte + WMS-Layer + Steuerung
src/components/maps/satellite-controls.tsx     Play/Pause/Step/Speed/Timeline UI
src/lib/satellite.functions.ts                 Server-Fn + Regions-Config
src/lib/maps-config.ts                         neuen Eintrag `satellit` ergänzen
src/components/map-tabs.tsx                    Tab aktiv schalten (Status `live`)
src/components/embeds/satellit-noscript.tsx    Noscript-Fallback (analog Radar)
src/routes/embed.satellit.tsx                  Embed-Variante
```

### Leaflet-Setup

- `MapContainer` mit `zoomControl`, `attribution` (EUMETSAT/EUMETView gemäss Nutzungsbedingungen).
- Hintergrund-Basemap: CartoDB Dark Matter (wie Radar) für Konsistenz.
- 2 vorgeladene `L.TileLayer.WMS`-Instanzen, die per Frame-Step gecrossfaded werden (`opacity` 0↔1, 250 ms) — verhindert Flackern beim Frame-Wechsel.
- WMS-Request:
  ```
  https://view.eumetsat.int/geoserver/wms
    ?service=WMS&version=1.3.0&request=GetMap
    &layers={layer}&styles=&format=image/png&transparent=true
    &time={ISO}&tiled=true&width=256&height=256
    &crs=EPSG:3857&bbox={...}
  ```
- Frame-Preloading: nächste 3 Frames vorausladen via `new Image()` + Browser-Cache.

### Optional-Layer (Toggles)

- Ländergrenzen: vorhandenes `src/data/` enthält bereits Thurgau/Lake; für Welt nutzen wir `world-atlas/countries-50m.json` (npm: `world-atlas`, ~50 kB), gezeichnet als `L.GeoJSON` Linie.
- Kantonsgrenzen CH: vorhandene Schweiz-Datei wiederverwenden (falls vorhanden, sonst klein nachladen aus `swissBOUNDARIES` simplified GeoJSON, on-demand).
- Ortsnamen: kleine kuratierte Liste der grössten CH/EU-Städte als `L.Marker` mit Text-Label (kein externer Service).
- Höhenrelief: optionaler Hillshade-Tile-Layer von ESRI (`World_Hillshade`) als zusätzliche transparente Layer mit Opacity-Slider.

Alle Toggles in einer Popover-Liste oben rechts, identisch zur Radar-Karten-Optik.

### Steuerung (satellite-controls.tsx)

- Play / Pause Button (Space-Shortcut).
- Vorwärts / Rückwärts Step (Pfeiltasten).
- Geschwindigkeit Select: 0.5× / 1× / 2× / 4× (Basis-Intervall 500 ms).
- Timeline: shadcn `Slider`, Tick pro Frame, Tooltip mit Uhrzeit beim Hover.
- Vollbild-Button: Browser Fullscreen API auf Map-Container.
- Anzeige oben: `Region · 21.06.2026 · 14:35 · Frame 18/30`.
- Auto-Refresh: alle 60s `router.invalidate()` der Manifest-Query; bei neuen Frames werden ältere am Anfang verworfen, Wiedergabeposition bleibt auf aktuellem Zeitstempel (nicht Index).
- Auto-Play beim Mount aktiviert.

### Responsive

- Desktop: Steuerleiste unter der Karte, volle Höhe nutzen.
- Tablet/Mobile: Steuerleiste kompakt überlagert (`absolute bottom-0`), Touch-Gesten von Leaflet (pinch zoom, drag), Vollbild-Button prominent.
- Verwendung des bestehenden `useIsMobile()`-Hooks.

### Fallback

- Wenn ein WMS-Request 404/500 liefert (Tile fehlt), Frame überspringen und im Timeline-Tick ausgrauen.
- Wenn das ganze Manifest leer ist: Card mit Hinweis "Satellitenbilder vorübergehend nicht verfügbar".

## Navigation

- `src/lib/maps-config.ts`: neuer Eintrag `{ id: "satellit", label: "Satellit", routePath: "/karten/satellit", status: "live", icon: Satellite }`.
- `map-tabs.tsx` zeigt den Tab automatisch (über MAPS-Array).

## SEO

`head()` der neuen Route: Title "Satellitenbild Schweiz – Zeitraffer", Description, OG-Tags. Embed-Route bleibt `noindex`.

## Was NICHT gemacht wird

- Kein neuer GitHub-Action-Ingest, kein R2-Bucket, kein Cron — EUMETView serviert direkt.
- Kein API-Key, kein neues Secret.
- Keine Änderungen an Radar/Wind/Niederschlag.
- Keine Datenbanktabellen.
