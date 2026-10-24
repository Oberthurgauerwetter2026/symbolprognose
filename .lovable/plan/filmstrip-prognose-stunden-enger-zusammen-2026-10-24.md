# Filmstrip: Prognose-Stunden enger zusammen

Die Prognose bleibt im Stundentakt. Im Filmstrip rücken die Prognose-Stunden aber deutlich enger zusammen, damit man nicht endlos scrollen muss. Messung und erste Stunde nach „Jetzt“ bleiben breit wie heute.

## Was sich ändert

- Messung (5-Min-Takt) und erste Stunde nach „Jetzt“: Abstand bleibt wie bisher (96 px pro Stunde auf dem Handy).
- Danach (reine Stundenbilder): etwa 36 px pro Stunde auf dem Handy, 44 px am Desktop. Der Streifen wird dadurch rund 2,5-mal kürzer.
- Stundenzahlen im engen Teil nur alle 2 Stunden beschriftet, damit sie sich nicht überlappen. Die Striche pro Stunde bleiben.
- Die 10-Minuten-Striche fallen im engen Teil weg, weil es dort nur Stundenbilder gibt.
- Ziehen, Nachlaufen und Einrasten funktionieren gleich wie bisher.
- Gilt nur für das Radar. Satellit und Wind bleiben unverändert.

## Technische Umsetzung

`src/components/maps/filmstrip-timeline.tsx`:
- Neue optionale Prop `compressAfterMs` plus `compressedPxPerHour`. Ohne Prop bleibt das Verhalten linear (Satellit, Wind).
- Stückweise lineare Abbildung `msToX(ms)` / `xToMs(x)` statt `(ms - tMin) / h * PX_PER_HOUR`; verwendet für Breite, Bänder, Ticks, Labels, „Jetzt“-Marker, `translateX`, Drag-Delta und Momentum (Geschwindigkeit in px rechnen, dann über `xToMs` zurück in Zeit).
- Labels im komprimierten Bereich nur bei geraden Stunden; `ticks10` nur vor `compressAfterMs`.

`src/components/maps/radar-map.tsx`:
- Übergibt `compressAfterMs = nowMs + 60 min` (Beginn der reinen Stundenbilder).
