## Problem

Die "Balken" im Niederschlag entstehen, weil das Fallback-Grid (ICON-CH1, ~20×12 Punkte über die Region) zu grob ist. Die bilineare Interpolation erzeugt zwischen benachbarten Stützstellen achsen-parallele lineare Verläufe → optisch wie rechteckige Streifen/Balken. Das ist kein Bug der Datenpipeline, sondern eine Grenze der Datenauflösung.

Im Wunsch-Screenshot (MeteoSchweiz-Radar 1 km) liegen die Konturen weich, satt und blob-förmig. Dieselbe Optik lässt sich aus dem groben Grid durch Post-Smoothing + kräftigere Farb-Alpha annähern.

## Änderungen in `src/components/maps/radar-map.tsx`

1. **CSS-Filter Blur auf das Canvas-Overlay**
   - In der `CanvasLayer.onAdd()` zusätzlich:
     `cv.style.filter = "blur(6px) saturate(1.15) contrast(1.05)"`.
   - Wirkung: rechteckige bilinear-Kanten verschmelzen zu weichen Blob-Konturen, Farben wirken satter — genau die Optik aus dem Screenshot. Kosten: 0 (GPU-Filter), keine Performance-Auswirkung.

2. **Canvas-Opacity auf 1.0**
   - `cv.style.opacity = "0.9"` → `"1"`.
   - Der Halo am Rand kommt jetzt aus der Alpha-Kurve + Blur, nicht aus einer pauschalen Transparenz.

3. **Alpha-Kurve in `colorFor()` kräftiger**
   - Aktuell: `a = min(0.95, 0.7 + (i/14)*0.25)` → 0.70 … 0.95.
   - Neu: `a = min(1.0, 0.85 + (i/14)*0.15)` → 0.85 … 1.00.
   - Kombiniert mit Blur ergibt das die satte Mitte und den weichen, halb-transparenten Rand wie im Screenshot.

4. **STEP zurück auf 1**
   - `STEP = 2` → `STEP = 1` (zusammen mit Blur sieht das Pixel-Raster komplett verschwinden, statt 2×2-Blöcke unter dem Blur durchzuscheinen).
   - Innere `STEP`-Schleifen entfallen, der Code wird kürzer.

5. **Edge-Fade beibehalten**
   - Der in der letzten Iteration eingeführte `edgeFade` (sanfter Übergang am Grid-Rand, kein `clamp`-Extrapolieren) bleibt unverändert — verhindert weiterhin Balken bis an den Karten-Rand.

## Was sich NICHT ändert

- See, Aussen-Masken, Karten-Layer-Reihenfolge.
- Hagel-Punkte im Nowcast (schwarz).
- `radar.functions.ts`, Cron, Bbox, Legende, Color-Stops.
- Die Datenquelle bleibt; bei vorhandenem MCH-Radar-PNG wird ohnehin direkt das offizielle Bild gerendert.

## Erwartetes Ergebnis

Die Niederschlags-Felder erscheinen als weiche, kräftige Blobs mit sanften, halb-transparenten Rändern — visuell wie im Referenz-Screenshot. Keine sichtbaren Balken/Streifen mehr aus dem Stützstellen-Raster.