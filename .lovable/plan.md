## Änderung: 0,2-mm-Farbe auf #A7AED3 mit starker Transparenz

1. Zeile 59 in `src/components/maps/radar-map.tsx`:
   - RGB-Wert von `[108, 133, 189]` auf `[167, 174, 211]` (#A7AED3) ändern.

2. Funktion `colorFor()` (Zeile 70–80):
   - Für den ersten Skalenwert (0,2 mm, Index 0) eine deutlich niedrigere Alpha verwenden (z. B. 0,35 statt 0,75), damit die Farbe stark transparent wirkt.
   - Alle anderen Regen-Intensitäten bleiben bei Alpha 0,75.

Schnee- und übrige Regenfarben bleiben unverändert.