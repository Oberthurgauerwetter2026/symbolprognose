# Radar & Wind: Zoom ohne Verzögerung

## Problem

Die Farb-/Pfeil-/Partikel-Overlays auf der Radar- und Windkarte sind Canvas-Layer, die ihr Bild ausschliesslich neu zeichnen, wenn die Karte fertig ist (`moveend zoomend resize`). Während der Zoom-Animation bleibt das Canvas unverändert an der alten Position und in der alten Grösse liegen – erst am Ende springt es auf den neuen Zustand. Das wirkt als "Verzögerung" beim Rein- und Rauszoomen.

Betroffen (jeweils Canvas-Layer mit demselben Muster):
- Radar: Messungs-Overlay, Prognose-Crossfade-Overlay, zusätzliches Overlay im unteren Teil der Datei
- Wind: Farb-Overlay, Pfeil-Layer, Partikel-Layer

## Lösung

Die Canvas-Layer während der Zoom-Animation mitskalieren (wie Leaflet es für eigene Renderer macht), statt auf das Ende zu warten:

1. Auf `zoomanim` reagieren: das bestehende Canvas-Bild per CSS-Transform (Translate + Scale) auf den Zielzoom mitziehen, mit derselben Dauer/Easing wie die Kartenanimation. Damit bewegt sich das Niederschlags-/Windbild synchron mit den Kacheln.
2. Auf `zoomend` die Transform zurücksetzen und exakt neu zeichnen (bestehender `redraw`-Pfad, rAF-gebündelt).
3. Zusätzlich beim gedrückten Zoom-Scrollen defensiv einen Redraw anstossen (throttled per rAF), damit auch bei sehr langen Zoom-Sequenzen kein sichtbarer Versatz bleibt.
4. Kein Wechsel der Datenlogik: Farbskala, Interpolation, Crossfade und Partikelverhalten bleiben unverändert.

## Technische Details

- Gemeinsamer Helfer (z. B. `src/components/maps/canvas-zoom-anim.ts`): berechnet aus `e.center`/`e.zoom` per `map._latLngToNewLayerPoint` und `map.getZoomScale` die Transform und setzt sie via `L.DomUtil.setTransform(canvas, offset, scale)`.
- In `onAdd` jeder Canvas-Layer zusätzlich `map.on("zoomanim", …)` registrieren, in `onRemove` wieder abmelden; Transform in `redraw` auf Identität zurücksetzen.
- Beim Partikel-Layer im Wind wird die Transform nur während der Animation gesetzt; die Partikel-Positionen werden nach `zoomend` wie bisher neu initialisiert.
