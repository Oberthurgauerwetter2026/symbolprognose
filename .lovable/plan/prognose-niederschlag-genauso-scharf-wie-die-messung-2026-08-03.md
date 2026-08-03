# Prognose-Niederschlag genauso scharf wie die Messung

## Befund (an den Live-Daten geprüft)

- Messbild (`radar/precip/…png`): 240 × 144 Pixel auf demselben Ausschnitt → ca. 1 km pro Pixel.
- Prognosebild (`radar/forecast/…png`): 56 × 48 Pixel auf demselben Ausschnitt → ca. 4 km pro Pixel.

Beide Bilder laufen im Frontend durch exakt denselben Renderpfad (gleiche Farbskala, gleicher Kontrast, gleiche Deckkraft). Die weiche, verwaschene Optik der Prognose kommt allein aus der viel groberen Bildauflösung: beim Hochskalieren auf die Karte wird jeder Prognosepixel über mehrere Kilometer verschmiert.

## Änderung

1. **Prognosebilder im Messraster rendern**: Im Ingest wird das ICON-CH1-Feld vor dem Farb-Mapping auf das Raster der Messung (240 × 144 auf dieselbe Bounding-Box, ~1 km) gebracht. Dadurch entstehen gleich feine Kanten und gleich grosse Farbbänder wie bei der Messung.
2. **Bandkanten hart halten**: Das Farb-Mapping bleibt bandweise (harte Schwellen), die morphologische Bereinigung (`clean_precip_field`) läuft auf dem feinen Raster mit entsprechend angepassten Mindestflächen, damit keine neuen Einzelpixel-Sprenkel entstehen.
3. **Kein zusätzliches Weichzeichnen im Frontend**: Die extra 3×3-Glättung, die nur für Prognose-Frames aktiv ist, entfällt — Prognose und Messung nutzen dann identische Sampling- und Farblogik.

Ergebnis: Prognose sieht strukturell aus wie die Messung (gleich scharfe Kanten, gleiche Bandgrössen). Die Prognose bleibt physikalisch grob (Modellauflösung), gewinnt aber keine falschen Details — es wird nur sauber im gleichen Raster dargestellt statt hochgezogen und verschmiert.

Die neue Optik erscheint, sobald der nächste Prognose-Ingest gelaufen ist (Cron), bzw. sofort nach manuellem Auslösen.

## Technische Details

- `scripts/ingest_openmeteo.py`, Prognose-PNG-Renderer: Zielgitter auf die Messgrösse (240 × 144 über `bbox`) setzen; ICON-Werte per bilinearer Interpolation (NumPy) auf dieses Gitter bringen, dann `clean_precip_field` (min_area/hole_area entsprechend dem Flächenverhältnis skaliert) und erst danach `PRECIP_SCALE`-Bandfarben anwenden.
- `src/components/maps/radar-map.tsx`: in `PrecipOverlay` die `isForecastFrame ? smooth3x3(...)`-Zweige (Werte und Schnee) auf den Rohwert reduzieren; `MeasurementCanvasOverlay` bleibt unverändert (behandelt Mess- und Prognose-PNGs schon identisch).
- Keine Änderung an Farbskala, Deckkraft (0.6), Kontrastfilter, Timeline/Filmstrip oder am Morphing zwischen zwei Prognoseframes.
