## Ziel

Nur das reine Satellitenbild zeigen — keine Karten-Basemap, keine Grenzen, keine Ortsnamen, kein Relief, keine Overlays. Animation soll flüssig laufen (Vorab-Laden aller Frames + sauberer Crossfade). Schweiz und Alpen werden zu einer Region zusammengefasst. Quelle ist Meteosat Third Generation (MTG-FCI von Meteosat-12) über EUMETView WMS.

## Änderungen

### 1. Regionen (`src/lib/satellite.functions.ts`)
- "Schweiz" und "Alpen True Colour" zu einer Region zusammenführen:
  - `id: "alpen-ch"`, Label: `"Schweiz & Alpen"`, Layer: `mtg_fd:rgb_truecolour` (MTG-FCI / Meteosat-12), Zoom 7, Zentrum [46.7, 8.5]
- Übrige Regionen unverändert: Europa GeoColour, Europa IR, Global IR
- Default-Region: `alpen-ch`

### 2. Karte (`src/components/maps/satellite-map.tsx`)
- Basemap (CARTO dark) **entfernen** — Karte zeigt nur den WMS-Layer auf neutralem dunklem Hintergrund (`bg-[#000]`).
- Label-Layer (CARTO `dark_only_labels`) **entfernen**.
- Hillshade-TileLayer **entfernen**.
- Overlay-Toggles und Settings-Popover komplett **entfernen** (Grenzen, Kantone, Orte, Relief).
- WMS-Layer auf `transparent: false`, `format: "image/jpeg"` umstellen (kleiner, schneller, kein Alpha nötig ohne Basemap).
- Topbar behält nur: Regions-Select, Zeit-Badge, Vollbild-Button.

### 3. Flüssige Animation
- Frames **vorab laden**: beim Manifest-Empfang einmalig pro Frame ein verstecktes `L.tileLayer.wms` mit `opacity: 0` instanziieren und auf die Karte legen, damit Leaflet die Tiles cached. Erst wenn alle (oder die ersten N) Frames das `load`-Event gefeuert haben, startet die Playback-Loop.
- `CrossfadeWMS` umbauen zu **N-Layer-Stack** (ein WMS-Layer pro Frame, alle gemountet, alle mit `opacity:0` außer dem aktiven). Frame-Wechsel = nur Opacity-Umschalten → keine neuen Tile-Requests während Playback, kein Flackern.
- Während Vorab-Laden: kleiner Loading-Indikator + "Lade Frames …" im Zeit-Badge. Play-Button erst aktiv, wenn ≥ 80 % der Frames geladen sind.
- Default-Speed bleibt 1× (500 ms); Speed-Select unverändert.

### 4. Attributions-/Quellen-Hinweis
- Im Zeit-Badge kleinen Zusatz: `EUMETSAT · Meteosat-12 (MTG-FCI)` für True-Colour-Regionen, entsprechend für GeoColour/IR.

## Nicht im Scope
- Keine Änderungen an `karten.satellit.tsx`, `embed.satellit.tsx`, `maps-config.ts`.
- Keine neuen Datenquellen — weiterhin EUMETView WMS ohne Key.
