## Ziel
Die Niederschlags-Klassen sollen als **klare, geschwungene Konturen** dargestellt werden (wie Radar/MeteoSchweiz-Akkumulationskarten) — keine sichtbaren Pixelblöcke des Rohgitters mehr, aber weiterhin **harte Farbübergänge** zwischen den Klassen.

## Ursache des Pixel-Looks
`renderHeatmapDataUrl` macht aktuell **Nearest-Neighbor-Upsampling** (Faktor 4): jede Gridzelle wird als Block aus 4×4 identischen Pixeln gezeichnet → sichtbares Schachbrett. Die Klassengrenzen folgen den Zellkanten, nicht den Iso-mm-Linien.

## Lösung
Pro Ausgabepixel den **mm-Wert bilinear** aus den vier umliegenden Gitterpunkten interpolieren und **erst danach** die Klasse (`colorForAccum`) bestimmen. Ergebnis: weiche, kurvige Klassengrenzen — innerhalb einer Klasse aber weiterhin Volltonfarbe (keine Farbinterpolation, keine Verwaschung).

### Änderungen in `src/components/maps/precip-accum-map.tsx`

1. **`renderHeatmapDataUrl` neu schreiben**
   - Upsampling auf 8× (statt 4×) für glatte Bandkanten.
   - Pro Pixel `(px, py)` Float-Index `fx, fy` in Lat/Lon-Grid berechnen.
   - Bilineare Interpolation der vier Nachbarwerte → `mm`.
   - `colorForAccum(mm)` liefert die diskrete Klassenfarbe (volle Deckkraft 0.86).
   - Bounds-Berechnung (Halbzellen-Padding) bleibt.

2. **`renderExportCanvas` analog anpassen**
   - Gleiche bilineare Interpolation auf der Export-Innenfläche, damit das PNG dieselben weichen Konturen zeigt.

3. Klassengrenzen (`ACCUM_CLASSES`), Farben, Leaflet-Setup, Legende, Download-Flow, Refresh-Intervall: **unverändert**.

## Nicht betroffen
- Datenquelle, Akkumulationslogik, Routen, Auth, UI/Header, Legende.

## Erwartetes Ergebnis
Statt sichtbarer Rasterquadrate erscheinen die Niederschlagsklassen als zusammenhängende, organisch geformte Flächen mit scharfen Farbsprüngen zwischen den Stufen — sowohl auf der Karte als auch im PNG-Export.
