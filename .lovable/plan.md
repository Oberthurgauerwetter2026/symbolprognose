# Regenbalken als Zeitachsen-Leiste

Aktuell zeigt `DayRainSparkline` 8 vertikale Säulen (3-h-Buckets). Der Screenshot zeigt aber eine schmale **horizontale Leiste** am unteren Kachelrand mit einem farbigen Segment dort, wo Regen fällt – also eine Tages-Zeitachse von 00:00 bis 24:00 Uhr. Regen, der über Mitternacht hinausreicht, wird in der Kachel des Folgetags am Beginn fortgesetzt dargestellt.

## Änderungen

**Nur** `src/components/weather-widget.tsx`, Komponente `DayRainSparkline`:

1. **Darstellung umbauen**: statt 8 vertikalen Säulen eine horizontale Leiste mit 24 nebeneinander liegenden Stunden-Segmenten (volle Breite, ca. 6 px hoch). Hintergrund = dünne Linie in `zinc-300/70`, vordergrund = Regen-Segment in `var(--wx-rain)`.
2. **Datenquelle pro Stunde**: für jede der 24 Stunden des `dayIso`-Tages prüfen, ob `hourly.precipitation[i] > 0` ODER `precipitation_probability[i] >= Schwelle` (z. B. ≥ 50 %). Wenn ja → Segment einfärben, Deckkraft skaliert mit mm (0.4–1.0).
3. **Fortlaufend in den Folgetag**: Da jede Kachel ihren eigenen Tag rendert, ergibt sich die Fortsetzung automatisch – Regen ab 22 Uhr erscheint am Ende der Freitags-Kachel und ab 00 Uhr am Anfang der Samstags-Kachel. Keine zusätzliche Logik nötig, nur sicherstellen, dass der erste/letzte Slot bündig ohne Lücke beginnt (kein `gap` zwischen Segmenten, dafür 1 px Border-Trenner alle 6 h als dezente Zeitmarken).
4. **Tooltip**: pro Segment "HH–HH+1 Uhr · X.X mm · YY %".
5. **Höhe der Kachelzeile**: aktuelle `h-4`-Box auf eine flache Leiste (`h-1.5`) reduzieren, damit Optik dem Screenshot entspricht; mm/% bleiben darüber in eigener Zeile.

## Nicht geändert

- Keine Backend-/Aggregations-Änderungen.
- `DaySummaryBar`, `DetailPanel`, Tile-Layout (Symbol/Temp/mm/%) bleiben unverändert.
- `FORECAST_VERSION` bleibt gleich (reine Darstellungsänderung).

## Prüfung

`/karten/lokal?lat=47.5428&lon=9.2871&name=Amriswil` – sichtprüfen, dass Tageskacheln eine Zeitachsen-Leiste zeigen und ein Regenereignis, das z. B. um 23 Uhr beginnt, in der Folgekachel bei 00 Uhr nahtlos fortgeführt wird.
