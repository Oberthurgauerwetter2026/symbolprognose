## Ziel
Alle Orte sollen schon bei leichtem Hineinzoomen sichtbar werden, schrittweise gestaffelt.

## Änderung
In `src/components/maps/precip-accum-map.tsx`, `CITIES`-Array (Zeilen 27–60), die `minZoom`-Schwellen verringern:

- **Stufe 0** (Bischofszell, Amriswil, Horn, Münsterlingen): bleibt immer sichtbar — kein `minZoom`.
- **Stufe 1** (Romanshorn, Arbon, Kreuzlingen, Weinfelden, Sulgen, Erlen, Güttingen, Egnach): `minZoom: 11` → **`minZoom: 10`**.
- **Stufe 2** (alle übrigen Kleinorte): `minZoom: 12` → **`minZoom: 11`**.

So sind ab Zoom 10 die mittelgroßen Orte zusätzlich zur Stufe 0 sichtbar, und ab Zoom 11 sind bereits alle Orte eingeblendet (statt erst ab 12).

Keine weiteren Änderungen — Filterlogik, Marker-Stil (Punkt + Label) und Zoom-Konfiguration der Karte bleiben unverändert.
