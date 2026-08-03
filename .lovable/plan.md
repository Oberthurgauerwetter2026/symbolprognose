# Radar-Prognose: Zellgrösse noch näher am Modell

Ziel: Die dargestellten Niederschlagszellen sollen in Grösse und Kontur dem ICON-CH1-Raster entsprechen — keine sichtbare Verbreiterung mehr durch Glättung und Aufskalierung.

## Was heute noch verbreitert

Die Prognose wird aus den hochauflösenden PNG-Kacheln gezeichnet (dichtes ~1,3-km-Raster). Auf diesem Weg gibt es drei restliche Weichzeichner:

1. Eine leichte Nachbarschaftsglättung auf den dekodierten Werten (Zentrum 12, Nachbarn je 1).
2. Das Zeichnen erfolgt auf einem halbierten Hilfsraster (jeder 2. Bildschirmpixel) und wird danach mit "high quality"-Interpolation hochskaliert.
3. Die Werteabtastung ist rein bilinear, wodurch Zellränder über 1–2 Rasterzellen ausgeschmiert werden.

## Änderungen

1. **Glättung für hochauflösende Frames abschalten**: Die PNG-basierten Prognose- und Messframes werden direkt mit den dekodierten Rohwerten gerendert. Die leichte Kantenglättung bleibt nur noch für den grob aufgelösten Zahlen-Fallback (Notfallpfad ohne PNG) erhalten.
2. **Volle Pixelauflösung beim Rendern**: Schrittweite des Hilfsrasters von 2 auf 1 Pixel, damit keine Details beim Hochskalieren verloren gehen bzw. verschmiert werden.
3. **Kantenschärfere Abtastung**: Die bilineare Interpolation wird mit einer leichten Kanten-Kompression versehen (Gewichtskurve statt linear), sodass Zellgrenzen dort liegen, wo das Modell sie hat, ohne harte Treppenstufen.
4. **Nachkontrolle Performance**: Die Frame-Canvas-Zwischenspeicherung bleibt bestehen; falls die volle Pixelauflösung das Abspielen messbar bremst, wird die Schrittweite geräteabhängig (mobil 2, Desktop 1) gesetzt.

## Technische Details

- `src/components/maps/radar-map.tsx`
  - `MeasurementCanvasOverlay`: `ensureSmooth` nicht mehr im Renderpfad verwenden (Rohwerte `src.mmh`), `STEP` auf 1, `sampleAt` mit Kanten-Kompressionskurve auf `tx`/`ty`.
  - `PrecipOverlay` (Zahlenraster-Fallback): `smoothEdge` bleibt unverändert, da dieses Raster grob ist.
  - `imageSmoothingQuality` beim Blitten auf `"low"`, weil bei Schrittweite 1 keine Aufskalierung mehr nötig ist.

Optional als Folgeschritt (nicht Teil dieser Umsetzung): Das Ingest-Raster von 120×140 auf echte ~1 km (ca. 140×165) heben — bringt maximal ~20 % mehr Detail, kostet aber mehr API-Abfragen pro Lauf.
