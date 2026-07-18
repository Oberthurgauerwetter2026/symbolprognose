## Problem

Auf `/karten/niederschlag` zeigen die 12/24/48h-Summen keine Daten mehr (Max 0.0 mm, 0% Fläche ≥1 mm, 0 Frames).

## Ursache (verifiziert in `src/lib/radar.functions.ts` + `precip-accum-map.tsx`)

Seit die Prognose aus vor-gerasterten PNGs kommt, füllt `getRadarFrames()` die Forecast-Frames mit `values: []` (Zeile 419) und liefert nur noch `precipUrl`. Der Canvas-Fallback aus dem ICON-CH1-Grid läuft explizit nur, wenn `!hasForecastPngs`.

`accumulatePrecip()` in `precip-accum-map.tsx` filtert aber genau nach numerischen Werten (`f.values.length === nPts`) — mit leeren Arrays fällt jeder Forecast-Frame raus, deshalb 0 Frames und Max 0 mm. Die Summenkarte hat keinen PNG-Pfad, sie braucht mm/h pro Grid-Punkt.

## Fix (nur `src/lib/radar.functions.ts`)

Beim Aufbau der PNG-basierten Prognose-Frames zusätzlich `values`/`snowValues` aus dem vorhandenen ICON-CH1-Cache (`r1.minutely_15`) füllen, wenn Grid und Zeitindex passen. Fallback bleibt: ICON-CH2 `hourly` für Zeiten, an denen CH1-Minutely nichts liefert.

Konkret:

1. Aus `r1` einen `forecastMinutelyIdx: Map<tMs, idx>` bauen (analog zu `pastTimeIdx`).
2. In der `for`-Schleife über `forecastManifest.frames`: wenn `r1` vorhanden und Grid nicht stale, per Zeit-Match (±10 min) das Werte-Array befüllen, sonst leeres Array beibehalten.
3. Optional: CH2-Hourly-Ergänzung auch dann laufen lassen, wenn `hasForecastPngs === true`, aber nur für Zeitpunkte jenseits des CH1-Minutely-Endes — damit 48h-Summen bis zum Horizont durchgehen.

Kein Rendering-Code, kein Ingest-Script, keine Datenbank angefasst. Radar-Animation nutzt weiter `precipUrl`; die Summenkarte bekommt jetzt zusätzlich die numerischen Werte, die sie erwartet.

## Verifikation

Nach dem Fix `/karten/niederschlag` neu laden: `framesUsed` > 0, `Max` und `%≥1 mm` plausibel, alle drei Karten (12/24/48 h) gefüllt.
