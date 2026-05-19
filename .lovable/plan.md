## Ziel

Tag 1–5 künftig aus den MeteoSchweiz-Ensemblemodellen **ICON-CH1-EPS** (Tag 1–2, ~33 h Reichweite) und **ICON-CH2-EPS** (Tag 1–5, ~120 h Reichweite) als Ensemble-Mittel beziehen, statt aus dem deterministischen `meteoswiss_icon_seamless`. Tag 6–7 bleibt **ECMWF IFS Ensemble-Mittel**, `best_match` bleibt Restfallback.

## Datenquellen (Open-Meteo Ensemble-API)

Alle drei Ensembles über `https://ensemble-api.open-meteo.com/v1/ensemble`:

| Quelle | `models=` | Members | Reichweite | Priorität |
|---|---|---|---|---|
| ICON-CH1-EPS | `icon_ch1_eps` | 11 | ~33 h | Tag 1–2 (höchste) |
| ICON-CH2-EPS | `icon_ch2_eps` | 21 | ~120 h | Tag 1–5 |
| ECMWF IFS | `ecmwf_ifs025` | 51 | bis 15 Tage | Tag 6–7 |
| `best_match` (Forecast-API) | – | – | – | Restfelder (Probability, Sunrise/Sunset) |

## Implementierung (`src/lib/weather.ts`)

1. `fetchEnsembleMean` generisch machen: zweites Argument `model: "icon_ch1_eps" | "icon_ch2_eps" | "ecmwf_ifs025"`. `forecast_days` modellabhängig (CH1: 2, CH2: 5, IFS: 7).
2. `fetchForecast` ruft parallel:
   - `fetchEnsembleMean(lat, lng, "icon_ch1_eps")`
   - `fetchEnsembleMean(lat, lng, "icon_ch2_eps")`
   - `fetchEnsembleMean(lat, lng, "ecmwf_ifs025")`
   - `fetchModel(lat, lng, "best_match")` (für Probability + Sunrise/Sunset + Notfall).
3. Primärquelle ist ICON-CH1-EPS (als `ForecastResponse` via `wrapEnsembleAsForecast`), `fillGaps` in fester Reihenfolge: **CH1 → CH2 → IFS → best_match**.
4. Daily-Werte für jeden Tag neu via `aggregateDailyFromHourly` aus den gemergten Hourly-Arrays berechnen (das alte „nur wenn MeteoSchweiz `temperature_2m_max` fehlt"-Special-Case entfällt, weil es jetzt keine deterministische Daily-Quelle mehr gibt). `precipitation_probability_max` und `sunrise`/`sunset` aus `best_match` übernehmen.
5. `meteoswiss_icon_seamless` wird nicht mehr abgefragt.

## Footer (`src/components/weather-widget.tsx`)

Text aktualisieren auf:
`MeteoSchweiz ICON-CH1-EPS/ICON-CH2-EPS · Tag 6–7: ECMWF IFS Ensemble · Rest: Open-Meteo best_match · aktualisiert HH:MM`

## Was unverändert bleibt

- UI, Theme, `TOTAL_DAYS = 7`
- Eigenes „Wahrscheinlichkeits"-Rendering nicht aus Ensemble-Spread berechnet (weiter `precipitation_probability_max` aus `best_match`)
- Kein Caching, kein zusätzlicher Spinner
