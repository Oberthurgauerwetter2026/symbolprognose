## Ziel

Die Richtungspfeile im Wind-Layer sollen je nach Windstärke deutlich unterschiedlich lang sein — analog zu den Partikeln, bei denen schneller Wind klar längere Spuren erzeugt. Aktuell starten die Pfeile bei `6 + sp*0.22`, d.h. ein Pfeil bei 5 km/h ist ~7 px, bei 80 km/h ~24 px, und alles deckelt früh bei `STEP*0.45` (~21–26 px). Der Unterschied ist optisch zu klein.

## Änderung

Nur `WindArrowLayer.redrawRef` in `src/components/maps/wind-map.tsx` (Zeilen 744–789) wird angepasst — keine anderen Layer, keine Steuerung.

1. **Pfeillänge proportional zur Geschwindigkeit**
   - Neu: `len = clamp(sp * 0.55, 3, STEP * 0.9)`
   - Ergebnis (bei `STEP = 58`, Zoom < 13):
     - 5 km/h → 3 px (Minimum)
     - 20 km/h → 11 px
     - 50 km/h → 27 px
     - 80 km/h → 44 px
     - ≥ 95 km/h → 52 px (Maximum, ~STEP·0.9)
   - Dynamikbereich damit ~17×, vorher ~3×.

2. **Pfeilkopf skaliert mit**
   - Neu: `ah = clamp(len * 0.28, 2.5, 7)` statt fixem `ah = 4`.
   - Schwache Pfeile bleiben dezent, starke wirken kräftiger.

3. **Linienstärke leicht windabhängig**
   - Neu: `ctx.lineWidth = clamp(1.0 + sp * 0.015, 1.0, 2.0)` statt fixer `1.4`.
   - Unterstützt das Mehr/Weniger-Gefühl ohne grafisches Übermass.

4. Schwellwert `sp < 1` (Pfeil ausblenden) bleibt unverändert; ebenso STEP-Raster, Farben, Zoom-Gate.

## Auswirkung

Pfeile in Flautengebieten werden zu kleinen Indikatoren (~3 px), Sturmböen erzeugen lange, klar sichtbare Pfeile bis fast an den Rasterabstand — sichtbar konsistent mit den Partikel-Streaks.