## Ziel

Primärquelle für Symbol- (Region) und Lokalprognose (Amriswil) ist neu die MeteoSwiss-Punktprognose aus der OGD-STAC-Kollektion `ch.meteoschweiz.ogd-forecast` (pro Gemeinde-JSON). Open-Meteo `icon_seamless` wird aus diesen Karten entfernt. MOSMIX bleibt als Ergänzung jenseits des local_forecast-Horizonts.

Nicht betroffen: Radar-Karte, Wind-Karte, Niederschlagssummen-Karte — die laufen weiter auf ICON-CH1/CH2 via Open-Meteo (das war separat festgelegt).

## Was bleibt, was geht

| Bereich | Bisher | Neu |
|---|---|---|
| Region (8 Spots) Symbolprognose | Open-Meteo Multi-Modell (`icon_seamless` Lead) + MOSMIX ab Tag 6 | MCH `local_forecast` pro Gemeinde + MOSMIX ab Tag 6/Horizont |
| Lokalprognose Amriswil | dito | dito |
| Embeds `lokal` / `region-lokal` | dito | dito |
| Snapshot/Noscript-Quellzeilen | "ICON-seamless via Open-Meteo" | "MeteoSchweiz local_forecast (OGD)" |
| Radar / Wind / Niederschlagssumme | ICON-CH1 → ICON-CH2 | unverändert |

## Architektur (R2 + GitHub-Workflow, wie bestehend)

```text
GitHub Workflow (cron-worker, stündlich)
  └─ scripts/ingest_mch_local_forecast.py
       ├─ STAC: holt für jede Spot-Gemeinde das aktuelle local_forecast-JSON-Asset
       ├─ mappt MCH-Felder → ForecastResponse-Schema (hourly + daily)
       └─ schreibt R2: mch/local_forecast.json
            { generatedAt, locations: { [spotId]: { hourly, daily, communeId, … } } }

Server-Funktion (Cloudflare Worker)
  getAggregatedForecast(lat,lon) / getAggregatedForecastBatch(points)
   1. neuer Reader getMchLocalForecastCache() liest mch/local_forecast.json
   2. picknearest by spot-ID (oder lat/lon → nearest spot)
   3. MOSMIX-Overlay ab Tag-Index = local_forecast-Horizont (in der Regel Index 5*24)
   4. Fallback-Kette wenn MCH-Cache leer/stale:
        a) bestehender openmeteo/symbol.json (phaseA)
        b) direkter Open-Meteo-Call (letzte Reissleine)
```

## Schritte

1. **Spot-zu-Gemeinde-Mapping**
   - In `src/data/spots.ts` jedem Spot eine `bfsId` (BFS-Gemeindenummer) zuordnen. Hardcodiert, keine Runtime-Lookups.
   - Horn TG `4486`, Amriswil `4461`, Bischofszell `4476`, Münsterlingen `4506`, Romanshorn `4511`, Hauptwil-Gottshaus `4491`, Langrickenbach `4501`, Egnach `4481` (BFS-Nummern beim Implementieren verifizieren).

2. **Ingest-Script `scripts/ingest_mch_local_forecast.py`** (neu)
   - STAC-Root: `https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-forecast`.
   - Pro Spot: jüngstes Item suchen, Asset-URL `forecast_<bfsId>.json` (oder von STAC-Items items-Endpoint geliefert) laden.
   - Felder mappen:
     - hourly: `temperature_2m`, `precipitation`, `precipitation_probability`, `weather_code` (MCH-Icon → WMO-Weathercode-Lookup-Tabelle), `wind_speed_10m`, `wind_gusts_10m`, `wind_direction_10m`, `snowfall`, `sunshine_duration`, `cloud_cover_*`.
     - daily: aus hourly aggregieren (vorhandenes `aggregateDailyFromHourly` wird im Reader sowieso erneut angewandt).
   - Payload `{ version, generatedAt, locations: {spotId: {bfsId, latitude, longitude, utc_offset_seconds, hourly, daily}} }` als `mch/local_forecast.json` nach R2.
   - Retry-Logik analog `ingest_openmeteo.py`.

3. **Workflow `.github/workflows/mch-local-forecast.yml`** (neu)
   - `workflow_dispatch`, triggert vom bestehenden `cron-worker/` (Eintrag dort hinzufügen, stündlich).
   - Secrets identisch zu `openmeteo-symbol.yml`.

4. **Reader `src/lib/openmeteo-cache.server.ts`**
   - Neue Funktion `getMchLocalForecastCache()` mit eigenem 30-s-Memo, holt `mch/local_forecast.json`.

5. **`src/lib/forecast-aggregated.functions.ts`**
   - Neue Loader-Branch `forecastFromMchCache(lat, lon)`: nimmt Spot by Distanz, baut `ForecastResponse` aus den vorgemappten Feldern, läuft durch `sanitizeForecast` und die bestehende Daily-Re-Aggregation.
   - In `getAggregatedForecast` und `getAggregatedForecastBatch`: zuerst MCH-Cache, dann altes phaseA-Cache, dann direkter Open-Meteo-Call.
   - MOSMIX-Overlay-Index dynamisch: `Math.min(5*24, mchHourly.time.length)` damit MOSMIX direkt am MCH-Horizont anschliesst.

6. **Copy/Quellangaben aktualisieren**
   - `src/routes/karten.lokal.tsx`: "ICON-seamless" → "MeteoSchweiz local_forecast (OGD)" in Title-Description und Subtitle.
   - `src/components/weather-widget.tsx` Zeile 1166.
   - `src/components/embeds/lokal-noscript.tsx` Zeile 185.
   - `src/components/embeds/radar-noscript.tsx` Zeile 120 (nur Symbol-Teil; Radar-Teil bleibt ICON-CH).
   - `src/routes/admin.tsx`: Provider-Zeilen für Symbol-/Lokalprognose.
   - `src/lib/snapshot.server.ts`: Snapshot-Quelle, falls Symbolprognose dort serverseitig erzeugt wird.

7. **Smoke-Test**
   - Workflow einmal manuell laufen lassen, R2-Datei prüfen.
   - Region- und Lokalprognose-Karte rendern, sicherstellen dass Hourly-Reihe und Tageskacheln plausibel sind und MOSMIX nahtlos anschliesst.

## Offene Punkte für die Umsetzung

- Exaktes STAC-Asset-Pattern und Feldnamen werden beim Schreiben des Python-Scripts gegen die Live-API verifiziert; falls MCH ein anderes ID-Schema (z. B. `forecast-<id>.json` oder gepackt in einer Sammlung) liefert, wird das Mapping dort angepasst.
- MCH-Icon-Codes (1–35 Tag/Nacht) → WMO-Weathercodes: kleine Lookup-Tabelle im Python-Script, damit das Frontend unverändert mit `weathercode` arbeitet.
- Wenn `local_forecast` für eine Gemeinde temporär fehlt, fällt der einzelne Spot automatisch auf phaseA zurück (keine Karten-Lücken).

## Keine Änderung

- `routeTree.gen.ts`, `src/integrations/supabase/*`, `src/components/maps/wind-map.tsx`, `radar-map.tsx`, `precip-accum-map.tsx` (bleiben ICON-CH).
