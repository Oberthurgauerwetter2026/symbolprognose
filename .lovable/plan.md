## Hauptwil-Gottshaus Koordinaten

`src/data/spots.ts` Zeile 16: Hauptwil-Gottshaus von `47.4806, 9.2719` auf **`47.4806, 9.3100`** setzen. Damit liegt die Pille klar am östlichen Rand der Ortschaft und überlappt nicht mehr mit Bischofszell-Pill bei Standard-Zoom. `minZoom: 12` bleibt.

## Smartphone-Responsivität verbessern

### Map-Seite (`src/routes/karten/region.tsx` + `region-map.tsx`)
- Map-Höhe bleibt `h-[420px] sm:h-[600px]` — akzeptabel, aber sicherstellen, dass Leaflet Touch-Gesten (Pinch-Zoom, Pan) nicht durch überlagerte UI-Elemente blockiert werden.
- Marker-Pillen: `whiteSpace: nowrap` bleibt, aber bei sehr kleinen Viewports prüfen, ob die Pille-Höhe/Breite die Karte überladen.

### Layout & Sidebar (`dashboard-layout.tsx` + `app-sidebar.tsx`)
- Derzeit: `SidebarProvider` mit `collapsible="icon"`. Auf Smartphones soll die Sidebar als Sheet-Overlay erscheinen (shadcn-Standard), aber der `SidebarTrigger` im Header muss gut erreichbar sein.
- Header: `h-14` ist OK, aber prüfen, dass der Titel bei langem Text nicht abgeschnitten wird (`truncate` ist schon gesetzt).

### Lokalprognose (`weather-widget.tsx`)
- Nutzt bereits `@container`-Queries und horizontales Scrollen mit `snap-x` — das ist schon mobilfreundlich.
- Prüfen, ob die Slot-Breiten (`w-[62px]`, `w-[108px]`) auf sehr kleinen Screens zu breit sind und ob das horizontale Scrollen flüssig läuft.

### Meta / Viewport
- `viewport`-Meta-Tag ist in `__root.tsx` schon vorhanden (`width=device-width, initial-scale=1`).

### Ziele
- Kein horizontaler Overflow auf Viewports < 400 px.
- Touch-Targets mind. 44 × 44 px.
- Sidebar lässt sich auf Mobilgeräten öffnen/schliessen.
- Karte lässt sich mit Touch-Gesten bedienen.