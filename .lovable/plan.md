## Änderungen in `src/lib/weather.ts`

### Ziel
Tag 6 und 7 nicht mehr aus `best_match` ergänzen, sondern aus **ECMWF IFS Ensemble-Mittel** (`https://ensemble-api.open-meteo.com/v1/ensemble`, model `ecmwf_ifs025`). `best_match` bleibt als letzter Rückfall für Felder, die das Ensemble nicht liefert (insb. `precipitation_probability`, `sunrise`/`sunset`).

### Neue Funktionen

1. **`fetchEnsembleMean(lat, lng)`**
   - Endpoint `https://ensemble-api.open-meteo.com/v1/ensemble`, `models=ecmwf_ifs025`, `forecast_days=7`, `timezone=auto`, gleiche `hourly`-Variablen (ohne `precipitation_probability`, das ist im Ensemble-Schema nicht vorhanden).
   - Response liefert pro Variable 50 Series `{var}_member01..member50`. Wir berechnen den Mittelwert pro Zeitindex (Wettercode-Mittel via Median, gerundet).
   - Rückgabe: `Partial<HourlyData>` mit gemittelten Arrays.

2. **`aggregateDailyFromHourly(hourly, dayIso)`**
   - Erzeugt für einen einzelnen Tag die Daily-Aggregate aus dem (gemergten) Hourly-Array: `temperature_2m_max/min`, `precipitation_sum`, `windspeed_10m_max`, `windgusts_10m_max`, `winddirection_10m_dominant` (Mittel-Vektor), `sunshine_duration`-Summe, `snowfall_sum`, `weathercode` (Median des Tages).

### Geänderte `fetchForecast`

Parallel:
- `meteoswiss_icon_seamless` (primary, Tag 1–5/6)
- `ecmwf_ifs025` Ensemble-Mittel (für Lücken, primär Tag 6/7)
- `best_match` (Restfeld-Fallback: `precipitation_probability`, `sunrise`, `sunset`, alles was Ensemble nicht hat)

Merge-Reihenfolge pro Hourly-Index:
1. MeteoSchweiz-Wert, wenn vorhanden
2. sonst Ensemble-Mittel
3. sonst `best_match`

Daily:
- Tage 1–5: aus MeteoSchweiz; fehlende Einzelfelder aus `best_match`.
- Tag 6–7: neu berechnen via `aggregateDailyFromHourly` über die gemergten Hourly-Arrays. `precipitation_probability_max`, `sunrise`, `sunset` aus `best_match` übernehmen.

### Anschliessend
`sanitizeForecast` läuft wie bisher als Sicherheitsnetz.

### Footer-Text in `src/components/weather-widget.tsx`
- Quellenzeile aktualisieren auf:
  `MeteoSchweiz ICON-CH1/CH2 · Tag 6–7: ECMWF IFS Ensemble · Rest: Open-Meteo best_match · aktualisiert HH:MM`

## Nicht enthalten
- Keine UI-Änderungen an Layout/Strip/Detail.
- Keine eigenen Wahrscheinlichkeits-Berechnungen aus den 50 Ensemble-Membern (zu komplex; `best_match`-Prob ist gut genug).
- Kein Caching/Persistenz neu.
