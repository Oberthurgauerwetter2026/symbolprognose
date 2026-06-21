## Ziel

Satellitenkarte (`src/components/maps/satellite-map.tsx`) an Radar-Look angleichen und vereinfachen.

## Änderungen

### 1. Schweiz-Umriss in „Schweiz & Alpen"
- `src/data/switzerland.json` als `FeatureCollection` importieren.
- Neue Komponente `SwissOutline` rendert `<GeoJSON>` mit Stil:
  `color: "#fff"`, `weight: 1.5`, `opacity: 0.9`, `fill: false`, `interactive: false`, `pane: "overlayPane"`.
- Nur einblenden, wenn `regionId === "alpen-ch"`. (Bewusst nicht in „Europa"-Layern, weil dort die Schweiz zu klein wäre — falls gewünscht, leicht erweiterbar.)

### 2. Zoom-Funktion entfernen
- `<ZoomControl>` löschen, `ZoomControl`-Import entfernen.
- `MapContainer`-Props: `zoomControl={false}` bleibt, zusätzlich
  `scrollWheelZoom={false}`, `doubleClickZoom={false}`, `touchZoom={false}`,
  `boxZoom={false}`, `keyboard={false}`, `dragging={false}`.
- `minZoom`/`maxZoom` auf den Region-Zoom fixieren (`region.zoom`), damit auch `flyTo` keinen anderen Zoom setzt.
- `FlyToRegion` → nur Center setzen (`map.setView(r.center, r.zoom, { animate: true })`), kein User-Zoom mehr möglich.

### 3. Slider analog Radar
- `SatelliteTimeline` bleibt (ist bereits radar-äquivalent), wird aber jetzt — wie im Radar — als **schwebendes Overlay-Panel unten in der Karte** platziert, nicht mehr in einer separaten Leiste unterhalb.
- Neuer Bereich innerhalb `MapContainer`-Wrapper:
  ```
  absolute inset-x-2 bottom-2 z-[450] sm:inset-x-3 sm:bottom-3
   └ pointer-events-auto rounded-xl border bg-white/90 p-2 shadow-lg backdrop-blur
       ├ runder Brand-Play-Button (h-9 w-9, BRAND-Farbe, weiss)
       ├ Prev (ChevronLeft, runder neutral Button, hidden auf mobile)
       ├ SatelliteTimeline (flex-1)
       ├ Next (ChevronRight, hidden auf mobile)
       └ Settings-Popover (Speed-Auswahl als Radio/Buttons)
  ```
- Speed-`Select` durch Popover mit Brand-Pill-Buttons ersetzen (analog Radar).
- Bottom-Border-Leiste unterhalb der Karte entfällt; Komponente ist kompakter.
- `SkipBack`/`SkipForward` durch `ChevronLeft`/`ChevronRight` ersetzen.

### 4. Moderner Region-Umschalter
- Statt `Select` ein **ToggleGroup** im Glas-Look oben links:
  ```
  rounded-full border bg-white/90 shadow-sm backdrop-blur p-0.5 flex gap-0.5
   └ pro Region: button px-3 h-8 rounded-full text-xs
       aktiv: bg-BRAND text-white
       inaktiv: text-neutral-700 hover:bg-neutral-100
  ```
- Verwendet `shortLabel` aus `SATELLITE_REGIONS`.
- Auf Mobile: horizontal scrollbar (`overflow-x-auto no-scrollbar`) falls eng.
- Vollbild-Button bleibt oben rechts, gleiche Pill-Optik (rund, weiss/Glas).
- Loader-Pill („Lade x/y …") bleibt rechts neben dem Umschalter, ebenfalls rund.

### 5. Quellen-Badge
- Bleibt unten links, aber wandert über das neue Steuerpanel hinaus (`bottom: panel-höhe + 6px`), z. B. `bottom-16`. Keine Funktionsänderung.

## Nicht-Ziele
- Keine Änderung an `satellite.functions.ts` (Layer, Frames, Cache).
- Keine Änderung am Embed-Pfad.
- Performance-Logik (`FrameStack`, JPEG, radial mount) bleibt unverändert.

## Dateien
- `src/components/maps/satellite-map.tsx` — alle obigen UI-Änderungen
