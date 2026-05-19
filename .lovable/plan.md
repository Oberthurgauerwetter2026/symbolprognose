## Ziel

Aktuell zeigt das Sonnenschein-Säulendiagramm pro 3-Stunden-Slot **einen** Balken mit dem Durchschnitt (z.B. „40 min" = Mittel aus 9–10, 10–11, 11–12 Uhr). Du willst stattdessen sehen, wie viele Minuten die Sonne **innerhalb jeder einzelnen Stunde** scheint (z.B. konkret 9–10 Uhr).

## Vorgeschlagene Umsetzung

Innerhalb jedes bestehenden 3-Stunden-Slots werden **3 schmale Säulen nebeneinander** gerendert — eine pro echter Stunde. Layoutbreite und Ausrichtung zu Regen/Schnee bleiben damit identisch („fliessend" über den ganzen Tag).

- Jede Säule nutzt `h.sunshine_duration[idx + k]` (k = 0,1,2), umgerechnet in Minuten (0–60).
- Y-Achse bleibt 0/30/60 min.
- Beschriftung unter dem Slot: kompakt drei Zahlen nebeneinander (z.B. `55 · 48 · 30`) statt einer einzelnen — oder optional nur die Stunden mit > 0 min. Default-Vorschlag: **drei Zahlen, klein, tabular**.
- Tooltip pro Säule: „09–10 Uhr · 55 min Sonne".
- Farbe/Opacity wie bisher (`var(--wx-sun)`).

## Betroffene Datei

- `src/components/weather-widget.tsx` (Sunshine-Block, Zeilen ~712–758). Keine Änderungen an `weather.ts`, Datenquelle oder anderen Charts.

## Offen

Soll die Stundenbeschriftung unter dem Slot **drei einzelne Minutenwerte** zeigen (z.B. `55·48·30`), oder reicht **der Slot-Mittelwert** als Zahl und die 3 Säulen visualisieren nur die Verteilung? Default ohne Antwort: drei Werte.
