## Problem

Nach der Umstellung auf die Modellkette CH1 (0–24h) → CH2 → IFS zeigt das Detail nur noch ~24 Stunden statt der vollen ~168 h. Vorher war CH2 die Primärquelle mit 120 h time-Array.

## Ursache

In `fillGaps` (src/lib/weather.ts, Zeile 162-163 und 178-179) wird `time` so gemerged:

```ts
time: h.time?.length ? h.time : (fh?.time ?? []),
```

Heißt: sobald die Primärquelle ein nicht-leeres `time` hat, wird das Fallback-`time` ignoriert. CH1 (primary, 24 Einträge) verhindert also, dass CH2/IFS ihre längeren Zeitachsen beisteuern. Die Daten-Arrays (`temperature_2m`, …) werden via `mergeArr` zwar auf die volle Länge erweitert, aber `time` bleibt 24 lang → die UI iteriert nur über 24 Stunden.

Gleiches Problem bei `daily.time`.

## Fix

In `fillGaps`:

1. `mergedHourly.time` aus der **längeren** Zeitachse bauen: nimm primary's `time`, hänge alle Fallback-Zeitpunkte ab Index `primary.length` an. Da Open-Meteo Hourly-Daten stündlich ab Stunde 0 des heutigen Tages aligned sind, reicht ein einfaches `[...pa, ...fa.slice(pa.length)]`.

2. Gleiche Logik für `mergedDaily.time`.

3. `mergeArr` bleibt unverändert (funktioniert bereits korrekt, da `len = max`).

Keine weiteren Änderungen nötig — die nachfolgende Daily-Aggregation in `fetchForecast` verarbeitet dann die volle Hourly-Reihe.

## Geänderte Datei

- `src/lib/weather.ts` (nur `fillGaps`, ~4 Zeilen)
