## Fix: Timeline auf 7 Tage erweitern, bevor MOSMIX überschreibt

Root cause: `fetchForecast` merged IFS (7-Tage-Ensemble) erst **nach** MOSMIX. Beim MOSMIX-Schritt hat die Timeline aber erst 120 h (CH1 24 h → CH2 fillGaps 120 h). MOSMIX hat keine Slots für Tag 6/7 → matched=0/0.

## Änderung in `src/lib/weather.ts` → `fetchForecast`

Neue Reihenfolge:

```text
1. primary = CH1 (24 h)
2. fillGaps mit CH2          → Timeline 0–120 h aus ICON
3. fillGaps mit IFS          → Timeline 0–168 h, Tag 6/7 vorerst aus ECMWF
4. overwriteFromIndex MOSMIX ab Index 120   ← überschreibt Tag 6/7 mit DWD
5. fillGaps mit best_match   → füllt Restfelder (probability, sunrise/sunset)
```

Konkret: die Zeile `if (ifsRaw && primarySource !== "ifs") merged = fillGaps(...)` wird **vor** den MOSMIX-Block gezogen. Sonst nichts.

## Diagnostik-Logs

Bleiben drin für eine Test-Runde. Nach erfolgreicher Verifikation (`matched > 100`, sample-Temperatur ändert sich) entferne ich sie wieder.

## Verifikation

Nach Edit:
1. Browser neu laden (oder Browser-Tool nutzt direkt frischen Bundle-Hash).
2. Erwartete Logs: `hourlyLen=168`, `matched=~48/48` (Tag 6+7 = 48 h), sample-Temp `before` ≠ `after`.