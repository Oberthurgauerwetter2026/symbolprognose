## Befund

Die 48-h-Karte sieht identisch zur 24-h-Karte aus, weil der Server schlicht keine Frames jenseits +24 h liefert.

In `src/lib/radar.functions.ts`:

- `forecastCutoff = now + 24 * 3600 * 1000` (Zeile 193) — harter Schnitt bei +24 h.
- Prognose-Frames werden ausschliesslich aus `phase1.minutely_15` der `:00`-Samples erzeugt — ICON-CH1, der nativ nur bis ca. +33 h reicht.
- Der frühere ICON-CH2-Block ist entfernt: *"ICON-CH2 (hourly, +33…+48 h) wurde mit Cutoff-Reduktion auf +24 h entfernt."* (Zeile 368).

In `src/components/maps/precip-accum-map.tsx` summiert `accumulatePrecip` bis `cutoff = now + hours*3600_000`, aber da keine Frames nach +24 h existieren, bricht die Schleife dort ab und die Werte für `hours=24` und `hours=48` sind identisch.

Die Ingest-Pipeline liefert die nötigen Daten bereits: `scripts/ingest_openmeteo.py` schreibt in `phase1` zusätzlich `hourly.precipitation` mit `forecast_hours: 120` (ICON-CH1 → ICON-CH2 Verlängerung). Diese Spalte wird im Worker aktuell ignoriert.

## Änderung

**Nur** `src/lib/radar.functions.ts`:

1. `forecastCutoff` auf `now + 48 * 3600 * 1000` anheben.
2. Im `LocResponse`-Typ `hourly.precipitation` und `hourly.snowfall` mitführen (snowfall optional ergänzen, falls von Open-Meteo geliefert).
3. Nach dem bestehenden ICON-CH1-Loop einen zweiten Loop einfügen, der aus `r1[pi].hourly` die Stunden `> letzteCH1-Stunde` und `≤ now + 48 h` als Frames mit `source: "icon-ch2"` emittiert. Stundenwerte aus `hourly.precipitation` sind bereits in mm/h — kein ×4 nötig.
4. Bias-Korrektur (`correction`) gleichermassen auf die CH2-Frames anwenden (Gewicht über `BIAS_FADE_MIN` läuft bereits gegen 0, ist also unkritisch).
5. Log-Zeile erweitern: `ch1=… ch2=…`.

Frontend (`precip-accum-map.tsx`) filtert bereits auf `icon-ch1 | icon-ch2` — keine Anpassung nötig. Die 12-h- und 24-h-Karten bleiben unverändert (gleiche CH1-Frames im Fenster).

## Validierung

- `/intern/niederschlag`: 48-h-Karte zeigt höhere Maxima und mehr Fläche ≥ 1 mm als 24-h-Karte; Footer-Zeile listet `icon-ch1 + icon-ch2` und mehr Frames.
- 12-h- und 24-h-Karte bleiben optisch identisch zu vorher.
- `/api/public/debug/r2-cache` muss `phase1 > 0` und `version` aktuell zeigen (sonst wartet die Erweiterung auf den nächsten Ingest-Run).
