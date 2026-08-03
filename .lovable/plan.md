# Prognose-Niederschlag 1:1 wie die Messung darstellen

## Ausgangslage (geprüft)

Messung und Prognose laufen im Frontend schon durch dieselbe Zeichen-Ebene (`MeasurementCanvasOverlay` in `src/components/maps/radar-map.tsx`) mit identischer Farbskala. Die Optik unterscheidet sich also nicht im Client, sondern in der Erzeugung der Prognose-PNGs (`scripts/ingest_openmeteo.py`):

- Die Prognose kommt aus einem 120 × 140-Modellgitter und wird **bilinear** auf ~1 km hochgerechnet → weiche Übergänge, breite runde Farbbänder. Die Messung wird per **Nearest-Neighbour** auf 240 × 144 gerastert → sichtbare quadratische 1-km-Zellen, harte Kanten.
- Die Speckle-/Loch-Bereinigung ist bei der Prognose mit der Rastervergrösserung mitskaliert (ca. 19 Pixel Mindestfläche) statt bei 9 Pixeln wie in der Messung → kleine Zellen verschwinden bzw. Flächen wirken glatter.
- Die Zielrastergrösse der Prognose ergibt 240 × 145 Pixel, die Messung 240 × 144 → minimale vertikale Verschiebung der Pixelkanten bei identischer BBox.

## Änderungen

Nur `scripts/ingest_openmeteo.py` (Prognose-Rasterung), keine Frontend-Änderung:

1. Hochrechnung von bilinear auf **Nearest-Neighbour** umstellen, damit die Prognose dieselbe blockige 1-km-Zellstruktur wie das Radarbild zeigt.
2. Zielraster fix auf **240 × 144** setzen (identisch zur Messung), statt es aus einem Grad-pro-Pixel-Wert zu berechnen.
3. Speckle-/Loch-Bereinigung auf **9 Pixel** fixieren – exakt wie im Messungs-Ingest, ohne Skalierung.

## Wirkung und Grenzen

Danach sind Farbskala, Raster, Pixelkanten und Bereinigung von Messung und Prognose identisch. Was bleibt: die Prognose stammt physikalisch aus einem ~1,3 km Modellgitter, also ist die *feine Struktur* naturgemäss weniger detailreich als eine echte Radarmessung – aber die Darstellung (Kanten, Zellen, Farbbänder) ist dann 1:1 dieselbe.

Die neuen Prognosebilder erscheinen mit dem nächsten Ingest-Lauf; bestehende PNGs werden dabei ersetzt.
