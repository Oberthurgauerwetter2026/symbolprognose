# Fix: Wetterkarte & Lokalprognose laden keine Daten

## Diagnose

- Frontend-Komponenten `weather-widget.tsx` und `region-map.tsx` rufen `getAggregatedForecast` (`src/lib/forecast-aggregated.functions.ts`).
- Diese Server-Funktion ruft `fetchForecast()` in `src/lib/weather.ts`, das **direkt** `api.open-meteo.com` und `ensemble-api.open-meteo.com` anspricht.
- Aus dem Cloudflare-Worker ist diese IP bei Open-Meteo rate-limited (429). Alle vier Modell-Calls (`ch1`, `ch2`, `ifs`, `best_match`) returnen `null` → `throw new Error("Keine Wettermodelle erreichbar")`.
- Radar (`radar.functions.ts`) und die Wochenforecast-Funktion (`getMultiModelForecast`) sind nicht betroffen, weil sie bereits den vorhandenen R2-Cache (`openmeteo/forecast.json`, `openmeteo/symbol.json`) lesen, der vom GitHub-Workflow `openmeteo-ingest.yml` alle 5 min frisch gehalten wird.

## Lösung

Aggregierten Forecast ebenfalls aus dem R2-Cache (`phaseA` = Multi-Modell hourly+daily, exakt das, was `fetchForecast` versucht zu rekonstruieren) bedienen — keine neuen Workflows, keine neuen Secrets nötig.

## Änderungen

1. **`src/lib/forecast-aggregated.functions.ts`**
   - Statt `fetchForecast(lat, lon)` zuerst `getOpenMeteoCache()` + nächstgelegenen `phaseA`-Punkt suchen (Logik wie in `getMultiModelForecast`).
   - Aus dem Cache-Eintrag eine `ForecastResponse` bauen:
     - `hourly` direkt aus `phaseA[idx].hourly`
     - `daily` direkt aus `phaseA[idx].daily`, falls Felder fehlen mit `computeDailyFromHourly()` aus `weather.ts` ergänzen (Funktion ggf. exportieren).
   - MOSMIX-Merge (`fetchMosmix`) optional weiter direkt aus dem Worker — nur **ein** Request, kein 429-Risiko; bei Fehler still ignorieren wie bisher.
   - Fallback: wenn Cache leer ist (R2 down), erst dann `fetchForecast()` versuchen.

2. **`src/lib/weather.ts`**
   - Helfer `computeDailyFromHourly`, `wrapEnsembleAsForecast`, `representativeWeathercode` ggf. exportieren, damit Punkt 1 sie wiederverwenden kann. Keine Logik-Änderung.

3. **Keine Änderungen** an Frontend-Komponenten, am Ingest-Workflow oder an `getMultiModelForecast`.

## Verifikation

- Server-Fn `7cf5…` (Aggregated Forecast) für eine Region-Koordinate aufrufen → Status 200 mit hourly/daily, statt 500 / „Keine Wettermodelle erreichbar".
- `/karten/region` und Lokalprognose-Widget zeigen wieder Symbole, Temperatur, Wind.
- Worker-Logs enthalten kein `429` mehr für `api.open-meteo.com`.
