## Diagnose

Die Netzwerk-Logs der laufenden Vorschau zeigen das Problem eindeutig:

```text
GET https://ensemble-api.open-meteo.com/v1/ensemble?...&models=meteoswiss_icon_ch1
GET https://ensemble-api.open-meteo.com/v1/ensemble?...&models=meteoswiss_icon_ch2
GET https://ensemble-api.open-meteo.com/v1/ensemble?...&models=ecmwf_ifs025
  → 429 Too Many Requests
  → {"reason":"Daily API request limit exceeded. Please try again tomorrow."}
```

`api.open-meteo.com/v1/forecast?models=best_match` antwortet weiterhin mit 200, alle drei Ensemble-Modelle für **alle vier Region-Spots** laufen aber ins IP-Tageslimit.

Ursache:
- `src/lib/weather.ts → fetchForecast()` ruft pro Standort **direkt aus dem Browser** drei Ensemble-Endpunkte + `best_match` + MOSMIX auf.
- Die Region-Karte rendert vier Spots, der Lokal-Widget mindestens einen — pro Seitenaufruf werden also ≥ 16 Open-Meteo-Requests von **derselben Besucher-IP** ausgelöst (bei jedem Reload neu, weil `staleTime` nur clientseitig wirkt).
- Open-Meteo zählt das harte Tageslimit pro IP — sobald es überschritten ist, liefern alle Ensembles 429. `fetchForecast` fängt das einzeln mit `.catch(() => null)` ab und fällt auf `best_match` zurück, aber:
  - Wenn auch best_match in dasselbe IP-Limit läuft (passiert je nach Tagesverlauf), bleibt `primary = null` → `throw "Keine Wettermodelle erreichbar"` → das Widget zeigt keine Symbolprognose mehr.
  - Selbst wenn best_match noch kommt, fehlen die Ensemble-Felder und die Multi-Modell-Mittel sind faktisch nur noch best_match — die Symbolprognose „kommt nicht mehr richtig".

Der bereits existierende R2-Cache (`openmeteo/symbol.json`, gefüllt 4× täglich vom Cron-Worker) wird vom Forecast-Pfad **nicht** genutzt — nur vom Radar und vom Admin-Debug.

## Lösung

Den kompletten Multi-Modell-Forecast serverseitig vorhalten und vom Frontend nur noch eine einzige, gecachte Server-Function abrufen. Damit sieht Open-Meteo nur noch wenige Requests pro Tag (vom Cron-Worker) statt einen pro Besucher.

### 1. Ingest erweitern (`scripts/ingest_openmeteo.py`)

`phaseA` (best_match Multi-Modell 7 d) zusätzlich abrufen:

- `cloud_cover_low`, `cloud_cover_mid`, `cloud_cover_high` in der hourly-Liste ergänzen (für die neue Wolken-Layer-Logik im Icon-Dispatcher).
- Optional: zweiter Aufruf `phaseA_ensemble` für `meteoswiss_icon_ch1`, `meteoswiss_icon_ch2`, `ecmwf_ifs025` (hourly: weathercode, temperature_2m, precipitation, windspeed/gusts/direction, snowfall, sunshine_duration) — pro Grid-Punkt **nur einmal alle 6 h** statt pro Besucher.

Resultat wird wie bisher als `openmeteo/symbol.json` (Schlüssel `phaseA`, neu `phaseA_ensemble`) in R2 abgelegt.

### 2. Neue Server-Function `getAggregatedForecast` (`src/lib/forecast.functions.ts`)

Ersetzt im Frontend die Direktaufrufe an `api.open-meteo.com` / `ensemble-api.open-meteo.com`:

- Input: `{ lat, lon }`.
- Liest `phaseA` + `phaseA_ensemble` aus `getOpenMeteoCache()`.
- Findet den nächstgelegenen Grid-Punkt (wie `getMultiModelForecast` heute).
- Führt **die bisher in `fetchForecast` enthaltene Merge-Pipeline** (`fillGaps`, MOSMIX-Overlay ab Tag 6, `aggregateDailyFromHourly`, `sanitizeForecast`) serverseitig aus.
- MOSMIX bleibt im selben Aufruf (Server-fetch zur DWD-API; viel großzügigeres Limit, einmal pro Spot/15 min memoisiert).
- Cache-Header: `public, max-age=600, s-maxage=900, stale-while-revalidate=3600`.

### 3. Frontend umstellen

- `src/lib/weather.ts`: `fetchForecast(lat, lon)` wird zu einem dünnen Wrapper, der `getAggregatedForecast` per `useServerFn` aufruft. Die bisherige Browser-Logik (`fetchEnsembleMean`, `fetchModel`, MOSMIX-Client) entfällt im Render-Pfad — Code bleibt für den Server-Pfad bestehen, importiert aus einer `.server.ts`-Variante.
- `src/components/weather-widget.tsx` und `src/components/region-map.tsx`: keine Signatur-Änderung nötig, sie nutzen weiterhin `useQuery({ queryFn: () => fetchForecast(...) })`. `staleTime` auf 15 min belassen.

### 4. Fallback-Verhalten

Wenn `phaseA_ensemble` im Cache fehlt (Ingest-Fehler), liefert die Server-Function `phaseA` (best_match) sauber zurück — wie heute, aber konsistent und ohne 429.

## Erwartung

- 0 Open-Meteo-Requests aus dem Browser. Symbolprognose, Region-Karte und Lokal-Widget rendern wieder zuverlässig — auch bei vielen Besuchern.
- Die kürzlich eingeführte Wolken-Layer-Heuristik (low/mid/high) funktioniert weiter, weil die Felder jetzt im Cache vorhanden sind.
- Cron-Worker zieht Ensembles 4× täglich für das Grid statt pro Besucher → unter dem IP-Tageslimit.

## Nicht in diesem Plan

- Verhalten der Radar-Karte (nutzt bereits `phase1`/`phaseB` aus dem R2-Cache, nicht betroffen).
- UI-Änderungen an Symbolen, Tiles oder Stundenslots — die neue Wolken-Layer-Logik bleibt unverändert.
