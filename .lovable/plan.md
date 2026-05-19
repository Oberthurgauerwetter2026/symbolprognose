## Ziel

Regen-Diagramm analog zum Sonnenschein umstellen: **3 Säulen pro 3-Stunden-Slot**, jede zeigt die Regenmenge (mm) der jeweiligen Einzelstunde (z.B. 9–10, 10–11, 11–12 Uhr). Gilt durchgehend für alle Tage.

## Umsetzung in `src/components/weather-widget.tsx` (Regen-Block ~664–710)

- Für jeden Slot `[k=0,1,2]` lesen:
  - `mm = h.precipitation[idx + k] ?? 0`
  - `prob = h.precipitation_probability[idx + k] ?? 0`
- Y-Achse bleibt 0 / 2.5 / 5 mm (mm/h-Skala, da Werte bereits stündlich).
- 3 schmale Säulen nebeneinander (`w-2 @[640px]:w-2.5`), gleiche Farbe `var(--wx-rain)`, Opacity wie bisher abhängig von Wahrscheinlichkeit der jeweiligen Stunde.
- Tooltip pro Säule: „09–10 Uhr · 1.4 mm · 80%".
- Beschriftung unter dem Slot:
  - Zeile 1 (mm): drei Werte nebeneinander, z.B. `1.4 · 0.2 · –` (fett)
  - Zeile 2 (%): drei Wahrscheinlichkeiten nebeneinander, z.B. `80 · 40 · 10` (zinc-600)
  - Einheit „mm / %" entfällt aus Platzgründen — steht in Legende.

## Nicht betroffen

- Datenquelle, andere Charts (Schnee, Temperatur, Wind), DayStrip-Tageskarten, Legende.
