## Diagnose

Server-Antwort für Amriswil ist OK: `precipitation` ist überall 0 (weder MCH-STAC noch Open-Meteo melden Regen-mm für heute), `precipitation_probability` liegt aber bei 24 %. Die `DayRainSparkline` (`src/components/weather-widget.tsx:609`) blendet eine Säule jedoch nur ein, wenn `mm > 0 || prob >= 30`. Damit bleiben alle 8 Buckets unsichtbar (nur die grauen Tracks), obwohl der Wert "24 %" in der Kachel angezeigt wird. MCH/Meteo­Schweiz zeigt für denselben Punkt eine niedrige Regenwahrscheinlichkeits-Säule, die unser Widget verschluckt.

## Fix in `src/components/weather-widget.tsx` (`DayRainSparkline`)

1. Schwelle senken: Säule wird sichtbar, sobald `mm > 0 || prob >= 10`.
2. Höhenformel zweistufig:
   - Wenn `mm > 0`: Höhe wie bisher aus mm (Skala `max(2, maxMm * 1.1)`), volle Deckkraft.
   - Sonst (`mm == 0`, `prob >= 10`): Höhe = `prob`-Anteil eines fixen 100 %-Maßstabs (z. B. `max(8, Math.min(60, prob))`), reduzierte Deckkraft (~0.45) damit klar zwischen „Regen-mm" und „nur Wahrscheinlichkeit" unterschieden wird.
3. Tooltip bleibt gleich (`mm` + `prob`); Track-Hintergrund bleibt grau.

Keine weiteren Dateien, keine Aggregations- oder Cache-Änderungen, kein `FORECAST_VERSION`-Bump nötig — rein visuell.

## Prüfung

`/karten/lokal?lat=47.5428&lon=9.2871&name=Amriswil` — Heute-Kachel zeigt 8 niedrige, halbtransparente Säulen passend zu 24 % Regenwahrscheinlichkeit; an Tagen mit mm bleibt das bisherige Verhalten (volle Säulen aus mm) erhalten.
