Tiefst- und Höchstwerte in der Pille (daily-Modus) bekommen eine dezente Temperatur-Farbe, damit sie auf einen Blick einordbar sind — ohne den minimalen Look zu brechen.

## Umsetzung

In `src/components/region-map.tsx` (Zeilen 230–244) eine kleine Hilfsfunktion `tempTint(t)` einführen, die für einen °C-Wert eine gedämpfte Farbe liefert:

- ≤ −10°: `#3b5bdb` (tiefes Blau)
- −10 … 0°: `#4c6ef5` → `#5c9bd9`
- 0 … 10°: `#5c9bd9` → `#74c0fc` (kühl)
- 10 … 18°: `#62a87a` (neutral-grün)
- 18 … 25°: `#e8a23b` (warm)
- 25 … 30°: `#e8744a`
- > 30°: `#d6453b` (heiß)

Werte werden linear zwischen Stützstellen interpoliert.

Anwendung nur im **daily**-Modus:
- `tMin`: Farbe = `tempTint(tMin)` bei reduzierter Deckkraft (~75 %), Gewicht bleibt 600, Größe 14.
- `tMax`: Farbe = `tempTint(tMax)` voll deckend, Gewicht 700, Größe 16 — bleibt der visuelle Anker.
- Trenner `/` bleibt grau (`rgba(15,23,42,0.35)`).

Im **hourly**-Modus bleibt `tNow` schwarz wie bisher (oder optional ebenfalls leicht eingefärbt — sage Bescheid, falls gewünscht).

Keine Änderungen an Layout, Pillen-Hintergrund, Icon oder Schatten.