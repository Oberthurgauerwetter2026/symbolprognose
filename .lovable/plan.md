## Ziel

In `src/components/weather-widget.tsx` die Funktion `DayRainSparkline` von der horizontalen 24-Stunden-Leiste zurück auf die ursprüngliche Darstellung mit **8 vertikalen Säulen** (3-h-Buckets, 00–03, 03–06, …, 21–24 Uhr) umstellen — und sicherstellen, dass tatsächlich Regen sichtbar wird.

## Warum aktuell nichts sichtbar ist

Die horizontale Variante färbt eine Stunde nur dann ein, wenn `mm > 0 || prob >= 50`. Da die Open-Meteo-Stunden-Niederschlagsmengen oft `0.0` mm sind und Wahrscheinlichkeiten häufig unter 50 % liegen, bleibt die Leiste komplett blass. Bei den vertikalen Säulen wird stattdessen die **mm-Summe pro 3h-Bucket** als Höhe gerendert — auch sehr kleine Werte (>0.05 mm) sind sichtbar, weil die Höhe linear skaliert und eine `minHeight` gesetzt wird.

## Änderungen (nur `DayRainSparkline`)

1. Container: `flex h-8 w-full items-end gap-px` (vertikal, unten ausgerichtet).
2. 8 Buckets à 3 Stunden aus `hourly.precipitation`/`hourly.precipitation_probability` aggregieren (Summe mm, Max prob) — Tagesfilter via `iso.slice(0,10) === dayIso`.
3. Höhenskala: `height = clamp(mm / scale, 0, 1) * 100%`, wobei `scale = max(2 mm, maxBucketMm * 1.1)` — so wachsen Balken bei mehr Regen mit, schwacher Regen bleibt aber sichtbar.
4. Sichtbarkeit: jede Säule mit `bg-[var(--wx-rain)]`, `minHeight: 2px` wenn `mm > 0 || prob >= 30`, sonst leerer Hintergrund-Slot `bg-zinc-300/40`.
5. Tooltip pro Säule: `HH–HH+3 Uhr · X.X mm · YY %`.
6. Keine Backend-/Aggregations-Änderungen, `FORECAST_VERSION` bleibt `v10`.

## Nicht geändert

- `DaySummaryBar`, `DetailPanel`, Tile-Layout (Symbol/Temp/mm/%).
- Plan-Datei `.lovable/plan.md` wird auf die neue Beschreibung angepasst.

## Prüfung

`/karten/lokal?lat=47.5428&lon=9.2871&name=Amriswil` – sichtprüfen: pro Kachel 8 vertikale blaue Säulen, schwacher Regen ergibt mindestens eine dünne 2-px-Säule, stärkerer Regen entsprechend höhere Säulen.
