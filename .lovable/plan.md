# Radar-Karte: Standard-Zoom erhöhen

## Ziel
Die Radar-Karte soll beim ersten Laden und in der Standardansicht etwas näher herangezoomt werden, da der aktuelle Zoom noch zu weit entfernt wirkt.

## Aktueller Zustand
- Datei: `src/components/maps/radar-map.tsx`
- `MapContainer` hat aktuell: `zoom={9.0}` und `minZoom={9}`
- `zoomSnap={0.5}` erlaubt halbe Zoomstufen.

## Geplante Änderung
1. Standard-Zoom in `src/components/maps/radar-map.tsx` von `9.0` auf `9.5` erhöhen.
2. `minZoom` belassen, da die Datenkante nicht wieder sichtbar werden soll.
3. Keine weiteren Karten oder Einstellungen anpassen, da der Fokus explizit auf der Radar-Darstellung liegt.

## Erwartetes Ergebnis
Die Radar-Karte öffnet sich näher am Oberthurgau/Bodenseegebiet, ohne den begrenzten Datenbereich zu verlassen.
