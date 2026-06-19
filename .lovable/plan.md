## Ziel

MCH-Quantil-Band (10 %–90 %) für stündlichen Niederschlag visualisieren — analog zur MCH-Webseite. Zeigt „so viel könnte es minimal/maximal regnen", auch wenn der Median (`rre150h0`) 0 mm ist.

## 1. Ingest erweitern (`scripts/ingest_mch_local_forecast.py`)

`HOURLY_PARAMS` zusätzlich:
```py
"precipitation_q10": "rreq10h0",  # 10 %-Quantil Stundensumme (mm)
"precipitation_q90": "rreq90h0",  # 90 %-Quantil Stundensumme (mm)
```
In `build_spot` neu auslesen und in `hourly` mitschreiben.

## 2. Typen / Cache (`src/lib/openmeteo-cache.server.ts`)

`MchLocalForecastLocation.hourly` um die zwei optionalen Felder ergänzen:
```ts
precipitation_q10?: (number | null)[];
precipitation_q90?: (number | null)[];
```

## 3. Forecast-Schema (`src/lib/weather.ts`)

`HourlyData` um optionale Felder erweitern:
```ts
precipitation_q10?: number[];
precipitation_q90?: number[];
```
Merge-/Sanitize-Helpers ergänzen (analog `precipitation`). Open-Meteo liefert diese Felder nicht — bleiben dort leer/NaN.

## 4. Aggregator (`src/lib/forecast-aggregated.functions.ts`)

In `buildForecastFromMchLoc` die zwei Quantil-Arrays übernehmen (mit NaN-Fallback). Kein Overlay aus Open-Meteo — wenn MCH nichts liefert, bleibt das Band einfach weg.

## 5. Darstellung (`src/components/weather-widget.tsx`, Stunden-Säulen)

Im Stunden-Panel (Block ab Z. 1135) pro Slot zusätzlich:
- `q10`/`q90` aus `h.precipitation_q10[idx+k]` / `h.precipitation_q90[idx+k]` lesen.
- Wenn beide finite und `q90 > 0`:
  - Hintergrund-Band von `q10`- bis `q90`-Höhe in `var(--wx-rain)` mit `opacity: 0.18` (heller als der Risiko-Aufsatz, damit Layer unterscheidbar bleiben).
- Darüber wie bisher: probabilistischer Aufsatz (Risiko, opacity 0.25) und mm-Balken (deckend).
- Tooltip ergänzt eine dritte Zeile, wenn das Band existiert:
  `q10–q90: 0.0 – 1.2 mm`.

Legende unter dem Panel (Z. 1326) bekommt einen zusätzlichen Token:
```
[hellblaues schmales Band] 10–90 % Bereich
```

## 6. Tages-Sparkline (`DayRainSparkline`)

Optional dieselbe Logik anwenden: max-Wert des Buckets aus `q90`-Summe statt nur aus mm — sodass bei Wahrscheinlichkeits-Tagen ein Band sichtbar ist. (Kann auch in einem späteren Schritt erfolgen; im jetzigen Plan: **nicht** anpassen, nur Stunden-Panel, weil das die direkte MCH-Analogie ist.)

## Verifikation

- `npx tsc --noEmit` läuft sauber.
- In der Vorschau für Amriswil: Stunden mit 0 mm + 20 % Risiko + q90>0 zeigen ein helles Band; Tooltip enthält die q10–q90-Zeile.
- Im Ingest-Log erscheinen `hourly rreq10h0` und `hourly rreq90h0` mit nonzero-Counts > 0 für mindestens einen Spot.

## Nicht im Scope

- `rka150p0`-Beschriftung als „MCH P50" (Option 2) — separat behandeln.
- Anpassung der Tages-Sparkline (siehe Punkt 6).
- Backfill historischer R2-Daten — der nächste stündliche Cron-Lauf füllt automatisch.
