## Ursache

Dein Screenshot ist nicht schwächer, weil die Messwerte fehlen, sondern weil unsere Darstellung die offiziellen Niederschlagswerte anders visualisiert:

- Die App rendert MeteoSchweiz-CPC-Werte in diskreten mm/h-Bändern.
- Die niedrigsten Bänder wurden bereits heller gemacht, aber kräftigere Radar-Systeme wie SRF/MeteoSchweiz wirken zusätzlich durch andere Klassenfarben, höhere Deckkraft und teils stärkeres visuelles Enhancement.
- In der Prognose/Canvas-Darstellung wird das grobe ICON-CH1-Raster zusätzlich geglättet. Dadurch werden lokale Spitzen flächiger verteilt und erscheinen weniger intensiv als im offiziellen Radarbild.
- Es gibt ausserdem noch eine alte AROME-Ingest-Farbskala, die nicht zur neuen Radar-Palette passt und bei aktiver Nutzung viel blasser wäre.

## Umsetzung

1. **Mess-Radar kräftiger machen**
   - Die Radar-PNG-Palette in `scripts/ingest_radar.py` stärker an die SRF/MeteoSchweiz-Optik angleichen.
   - Besonders die Bereiche 0.3–3 mm/h sichtbarer machen, damit aus hellblau/blau schneller kräftiges Blau/Grün wird.
   - Version-Tag erhöhen, damit alte PNGs automatisch neu generiert werden.

2. **Frontend-Palette synchronisieren**
   - `SCALE` in `src/components/maps/radar-map.tsx` exakt auf dieselben Schwellen/Farben setzen.
   - Overlay-Deckkraft bei Messung und Prognose kontrolliert erhöhen, ohne Karte/Labels komplett zu überdecken.

3. **Prognose weniger „auswaschen“**
   - Im Canvas-Sampling die aktuelle 3×3-Gauss-Glättung reduzieren oder durch kompaktere Interpolation ersetzen.
   - Ziel: lokale Spitzen bleiben sichtbarer, Animation bleibt aber flüssig.

4. **Alte AROME-Skala angleichen**
   - `scripts/ingest_arome.py` auf dieselbe Palette bringen, falls diese Frames noch verwendet oder später reaktiviert werden.

5. **Workflow-Version aktualisieren**
   - `.github/workflows/radar-ingest.yml` auf den neuen Ingest-Versionstag setzen.

## Erwartetes Resultat

Bei gleicher Zeit sollen die Niederschlagsflächen optisch deutlich näher an SRF/MeteoSchweiz liegen: mehr kräftiges Blau/Grün/Gelb bei denselben Niederschlagskernen, weniger blasse Flächen, aber weiterhin transparente Karte und flüssige Animation.