# Falsche Gewitter-/Schneesymbole überall entfernen

Der Filter gegen unplausible Niederschlags- und Gewittersymbole wirkt derzeit nur teilweise. Zwei belegte Lücken:

1. Der Filter setzt das MeteoSchweiz-Originalsymbol im Feld `n` zurück — die Prognose speichert es aber unter `weathercode_mch`. Genau dieses Feld benutzen die Stundenprognose im Wetter-Widget und die Regionskarte im Stundenmodus. Deshalb erscheint dort weiter ein Gewitter-/Schneesturm-Symbol, obwohl der bereinigte Code korrekt ist.
2. Der Filter läuft nur im Hauptpfad (nächstgelegener MeteoSchweiz-Punkt). Die Ausweichpfade — Notfall-Cache ohne Distanzgrenze, der zweite Modell-Cache und der Batch-Pfad für die Regionskarte — laufen ungefiltert.

## Vorgehen

1. Im Filter das richtige Symbolfeld zurücksetzen, damit auch die Originalsymbole der Stundenprognose bereinigt werden.
2. Den Filter in allen Prognosepfaden aufrufen: Hauptpfad, Notfall-Fallback, zweiter Modell-Cache und Batch-Aufbereitung für die Regionskarte.
3. Prüfen, dass die Bereinigung ortsunabhängig greift (alle acht Orte plus freie Ortssuche), nicht nur für Amriswil.
4. Nachprüfen: Stundenprognose, Tagesübersicht, Regionskarte im Stundenmodus und die Embeds. Trockene Stunden dürfen kein Gewitter-, Regen- oder Schneesymbol zeigen; Stunden mit echtem Niederschlag müssen ihr Symbol behalten.

## Technische Details

- `src/lib/forecast-aggregated.functions.ts`
  - `dropImplausibleWetCodes`: `(h as { n?: number[] }).n` durch `weathercode_mch` ersetzen; Eintrag auf `null`/`undefined` setzen, statt `NaN` zu schreiben, damit die Renderer sauber auf den WMO-Code zurückfallen (`WeatherIcon` prüft `Number.isFinite(mchCode) && mchCode >= 1`).
  - Aufruf ergänzen in `nearestCacheFallback` (nach `overlayHourlyFromOpenMeteo`), in `forecastFromCache` (Pfad über `buildForecastFromCacheLoc`) und im Batch-Pfad der Regionskarte nach dem phaseA-Aufbau.
  - Bestehende Schwellen unverändert: Gewitter ab 0.5 mm bzw. 40 % oder q90 ≥ 1, sonstiger Niederschlag ab 0.1 mm bzw. 20 %.
- Keine Änderungen an `scripts/ingest_mch_local_forecast.py` (Zuordnungstabelle ist bereits korrigiert) und keine an den Icon-Komponenten.
- Verifikation: Build plus Abruf von `/api/public/embed/region-lokal-static` und der Regionskarte; zusätzlich stichprobenweise zwei Orte mit trockener und einer mit nasser Stunde vergleichen.
