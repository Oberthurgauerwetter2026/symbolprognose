## Problem

Auf mobilen Geräten wird das Wetter-Icon von Romanshorn am oberen Kartenrand teilweise abgeschnitten. Ursache: Der Marker (Pill 250×72 px, geografisch zentriert) ragt über die sichtbare Karte hinaus, weil `fitBounds` in `src/components/region-map.tsx` nur mit `padding: [4, 4]` Pixeln aufgerufen wird. Der zusätzlich auf den `regionBounds` gelegte Geo-Puffer (~0.002°) entspricht nur ca. 200 m und reicht für die ~125 px Marker-Halbbreite bzw. ~36 px Marker-Halbhöhe nicht aus — gerade Romanshorn liegt direkt an der nördlichen Regionsgrenze.

## Lösung

In `src/components/region-map.tsx` das `fitBounds`-Padding so erhöhen, dass am Rand platzierte Marker-Pills vollständig innerhalb des Karten-Viewports bleiben — auf allen Viewport-Grössen, ohne die Karte unnötig „klein" zu zoomen.

### Änderung in `BoundsFitter`

- `map.fitBounds(bounds, { padding: [4, 4] })` ersetzen durch ein an die Marker-Geometrie angelehntes Padding:
  - horizontal ≈ halbe Pill-Breite + kleiner Buffer (≈ 130 px)
  - vertikal ≈ halbe Pill-Höhe + Buffer für oberen Rand/Bedienelemente (≈ 48 px)
- Auf kleinen Viewports (z. B. `< 480 px` Breite) das Padding moderat reduzieren (z. B. 70 / 44), damit die Karte nicht zu stark herauszoomt, aber Romanshorn am oberen Rand frei bleibt.
- Padding bei `resize`/`orientationchange`/`ResizeObserver` neu berechnen (passiert ohnehin schon durch das bestehende `fit()`).

### Optional, nur falls nötig

Sollte das Icon trotz erhöhtem Padding bei sehr schmalen Geräten noch knapp am Rand kleben: den vertikalen Geo-Puffer in `regionBounds` (aktuell `sw.lat - 0.002 / ne.lat + 0.002`) am Nordrand leicht erhöhen (z. B. `+ 0.004` nur nach Norden). Erst einsetzen, wenn das Padding allein nicht genügt.

## Verifikation

- Vorschau auf Mobil-Viewport (z. B. 390×844) öffnen, Route `/karten/region`.
- Prüfen, dass das Romanshorn-Pill mit Icon vollständig sichtbar ist (kein Clipping oben).
- Desktop (1735×1239) gegenchecken: Karte darf nicht spürbar kleiner werden, alle anderen Pills weiterhin sauber im Bild.

## Betroffene Datei

- `src/components/region-map.tsx` (nur `BoundsFitter` bzw. der `fitBounds`-Aufruf)
