## Ziel
Bildqualität der Satellitenkarte (MTG-FCI HRFI) sichtbar erhöhen — ohne Layout- oder Feature-Änderungen.

## Aktuelle Situation
- WMS-Layer: `mtg_hrfi:rgb_geocolour` (native ~1 km), Fallback `mtg_fd:rgb_geocolour` (~3 km)
- `tileSize: 512`, `format: image/jpeg`
- Region CH: fester `zoom = 7`; DPR/Retina wird nicht berücksichtigt → auf HiDPI-Bildschirmen werden Tiles hochskaliert (unscharf)
- Kein `Sharpen`/`Interpolation`-Parameter Richtung GeoServer

## Vorgeschlagene Verbesserungen

### 1. HiDPI/Retina-Tiles (größter Effekt)
GeoServer WMS kann Tiles in doppelter Pixeldichte liefern. Statt fester 512 px:
- `tileSize: 512`, aber `width`/`height` in der WMS-Anfrage auf `1024` (via `FORMAT_OPTIONS=dpi:180` oder Leaflet-Trick: eigene `TileLayer.WMS`-Subclass, die bei `devicePixelRatio > 1` die interne `getTileUrl` mit doppelter Auflösung anfragt und per CSS auf 512 CSS-px skaliert).
- Bewirkt auf Retina/4K-Displays gestochen scharfe Darstellung.

### 2. Zoomstufe für Schweiz erhöhen
- CH-Region derzeit `zoom: 7`. Bei MTG HRFI (~1 km) ist `zoom 8` noch sinnvoll (Pixelgröße ~150 m/Tile-px). 
- Vorschlag: CH auf `zoom: 8` anheben (Alpen/Wolkenstrukturen deutlich detaillierter). Andere Regionen unverändert.

### 3. PNG statt JPEG (optional, Qualität > Bandbreite)
- `format: "image/png"` liefert artefaktfreie Wolkenkanten (JPEG-Blocking verschwindet). Kostet ~2–3× mehr Bandbreite. Als Option erwägen, Standard bleibt JPEG.

### 4. GeoServer-Rendering-Hints
- Über `FORMAT_OPTIONS=antialias:full` bzw. `tiled:true` und Interpolation `bicubic` (WMS-Vendor-Params) leicht schärfere Skalierung.

## Empfohlene Umsetzung (schrittweise, minimal-invasiv)
1. HiDPI-Tiles aktivieren (custom WMS-Klasse, nur `wms.getTileUrl` überschreiben, verdoppelt `WIDTH`/`HEIGHT` bei `devicePixelRatio >= 2`). Betrifft nur `satellite-map.tsx`.
2. CH-Zoom in `src/lib/satellite.functions.ts` von 7 → 8.
3. Vendor-Params `format_options=antialias:full;interpolation:bicubic` an WMS-Requests anhängen.

Punkt 3 (PNG) nur auf Wunsch — kostet Traffic.

## Technische Details
- Datei-Änderungen: `src/components/maps/satellite-map.tsx`, `src/lib/satellite.functions.ts`.
- Keine Änderungen an UI, Timeline, Backend oder Datenmanifest.
- Fallback-Logik (`mtg_fd`) bleibt erhalten.

Frage: Alle drei Schritte umsetzen, oder nur HiDPI + Zoom (empfohlener Default)?