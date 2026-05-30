## Ziel

Standard-Zoom auf `/karten/radar` auf **9.5** setzen (zwischen 9 und 10).

## Änderung in `src/components/maps/radar-map.tsx`

Am `<MapContainer>`:
- `zoom={10}` → `zoom={9.5}`
- neu: `zoomSnap={0.5}` (damit Leaflet halbe Stufen erlaubt — sonst snappt es zurück auf 10)
- `zoomDelta={0.5}` (damit Zoom-Buttons/Tastatur in 0.5er-Schritten gehen, konsistent)

Alles andere bleibt (center, minZoom 8, ZoomControl, Layers, ZoomGate-Schwelle 10.5 für Ortslabels — die wird durch 0.5er-Zoom nicht beeinträchtigt).

## Validierung

- Beim Öffnen sitzt die Karte sichtbar zwischen den vorherigen Stufen 9 und 10.
- Zoom-Buttons gehen in 0.5er-Schritten.
- Ortslabels erscheinen weiterhin ab Zoom 10.5.
