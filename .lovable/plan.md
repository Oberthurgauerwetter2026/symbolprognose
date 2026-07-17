## Ziel

Im Satellit-Loop-Widget (`/embed/satellit-loop`) soll die ganze Schweiz bei beliebiger Widget-Grösse immer sichtbar sein. Aktuell ist Zoom fix auf 7 (`alpen-ch`), wodurch bei kleineren Iframes Teile der Schweiz abgeschnitten werden und bei grossen Iframes viel Leerraum entsteht.

## Änderungen (nur `src/components/maps/satellite-map.tsx`)

1. **Schweiz-Bounds als Konstante** definieren (ungefähr `[[45.75, 5.9], [47.85, 10.55]]`), plus kleines Padding, damit Grenzregionen nicht am Rand kleben.

2. **`FlyToRegion`** erweitert einen neuen Modus `fitBounds`:
   - Normal (wie bisher): `setMinZoom/MaxZoom/View` auf `region.zoom` und `region.center`.
   - Wenn `fitBounds`-Prop gesetzt (nur im Loop): `map.getBoundsZoom(CH_BOUNDS, true)` berechnet den grössten Zoom, bei dem die Schweiz komplett in den Container passt. Der Wert wird auf ganzzahlige Zoomstufen abgerundet (WMS/WMTS liefert nur diskrete Zooms), auf ein sinnvolles Fenster geklammert (min 5, max 9) und mit `setMinZoom/MaxZoom/setView(CH_CENTER, z)` fixiert.
   - Ein `ResizeObserver` auf dem Map-Container ruft die Fit-Berechnung erneut auf, wenn sich die Iframe-Grösse ändert (z. B. responsives Widget). Debounce ~150 ms.

3. **`SatelliteMap`** übergibt `fitBounds={loop}` an `FlyToRegion`. Für Nicht-Loop-Ansicht bleibt alles unverändert.

4. **FrameStack-Key**: Der `key` enthält bereits `regionId` und `layer`. Da `regionId` beim Loop weiterhin `alpen-ch` bleibt und der Zoom sich lediglich zwischen ganzzahligen Stufen bewegt, muss der Zoom nicht in den Key. WMS-Kacheln reagieren automatisch auf Zoomänderung.

5. **Frame-Prefetch**: Der bestehende `<link rel="prefetch">`-Pfad bleibt gleich (basiert auf `frame.url`, nicht auf dem Kartenzoom).

## Nicht-Änderungen

- Volle App-Ansicht, andere Embeds und Regions-Umschalter bleiben unverändert.
- Es werden keine Regionen ergänzt oder entfernt; der Loop nutzt weiterhin `alpen-ch` (MTG GeoColour).
- Blitz-Overlay, Filmstrip, Attributions-UI unangetastet.

## Verifizierung

- Playwright-Screenshot des Loop-Embeds bei drei Grössen (300×200, 640×360, 1200×700). Erwartung: gesamter CH-Umriss inkl. Bodensee, Genfersee und Tessin sichtbar, mit ~10 px Rand.
- Kontrolle, dass in der Nicht-Loop-Ansicht Region-Tabs und der bisherige Zoom unverändert funktionieren.
