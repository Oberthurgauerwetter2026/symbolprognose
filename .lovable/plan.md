## Ziel

Den bestehenden Open-Meteo R2-Cache von 2 Phasen (Radar) auf das **3-Phasen-Schema** aus dem Amriswil-Projekt erweitern. Damit landet der komplette 7-Tage-Multi-Modell-Forecast in R2, statt pro Worker-Request live bei Open-Meteo geholt zu werden.

```text
GitHub Action (alle 5 min) ─► Open-Meteo (3 Phasen) ─► R2 (openmeteo/forecast.json)
                                                          ▲
Cloudflare Worker / Server-Fn ───────────────────────────┘  (nur lesen, 30 s edge cache)
```

## Schritte

1. **`scripts/ingest_openmeteo.py` erweitern** auf 3 Phasen:
   - **Phase A** — Multi-Modell hourly+daily, `forecast_days=7`, Modelle: `meteoswiss_icon_ch2,icon_d2,arpege_europe,ecmwf_ifs025,gfs_global`. Variablen: temperature_2m, humidity, precipitation, weathercode, cloudcover, wind_speed/dir/gusts, pressure_msl + daily min/max/sum.
   - **Phase B** — ICON-CH1 `minutely_15`, ±6 h (Nowcast). Ersetzt aktuelles `phase1`.
   - **Phase C** — Bias-Lookback hourly, `past_days=7`, `best_match` (temperature_2m, wind_speed_10m).
   - Version-String auf `oberthurgau-openmeteo-cache-v2` setzen, BBox bleibt 47.38–47.72 / 9.00–9.62, Grid 9×14.
   - Payload-Struktur: `{ version, generatedAt, grid:{points}, phaseA, phaseB, phaseC }`.

2. **`src/lib/radar.functions.ts` migrieren**: liest weiterhin `openmeteo/forecast.json`, aber neue Felder `phaseB` (statt `phase1`) und `phaseA[*].hourly.precipitation` (statt `phase2`). Logik (Frame-Erzeugung, Cut-off, Manifest-Merge) bleibt identisch.

3. **Neues `src/lib/openmeteo-cache.server.ts`** als zentrale Read-Helper-Datei (analog Amriswil): liest R2 einmal, in-memory Memo-Cache (30 s), liefert `getOpenMeteoCache()` für alle Server-Funktionen.

4. **Neue Server-Funktion `src/lib/forecast.functions.ts`** mit `getMultiModelForecast({ lat, lon })`: greift in `phaseA` zum nächstgelegenen Grid-Punkt, gibt `ForecastResponse`-kompatibles DTO zurück. Damit kann `weather.ts` optional auf Server-Read umgestellt werden — Client-Calls bleiben aber als Fallback erhalten (jeder Besucher hat eigene IP, kein 429-Risiko).

5. **Debug-Route `src/routes/api/public/debug/r2-cache.ts`** (wie Amriswil) — listet `version`, `generatedAt`, Phasen-Längen. Erlaubt schnellen Check ob Cache frisch ist.

6. **`.github/workflows/openmeteo-ingest.yml`**: keine Änderung, Cron alle 5 min bleibt.

7. **Workflow manuell triggern** → in R2 prüfen, dass `openmeteo/forecast.json` ~3× grösser ist (3 Phasen) und Radar weiter funktioniert.

## Voraussetzungen

R2-Secrets sind bereits gesetzt (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`) und `R2_PUBLIC_URL` als Env. Nichts Neues nötig.

## Was wir NICHT tun

- `src/lib/weather.ts` Client-Calls bleiben — Migration auf Server-Read ist optional, separater Schritt.
- `scripts/ingest_radar.py` und `.github/workflows/radar-ingest.yml` bleiben unverändert.
- Kein Breaking-Change im Frontend — Radar-Payload (`getRadarFrames`) gibt das gleiche Format zurück.

## Risiken

- **Payload-Grösse**: Phase A mit 5 Modellen × 126 Grid-Punkten × 7 d hourly ≈ 1–2 MB. Vertretbar, R2-Read ist günstig.
- **Open-Meteo-Limit beim Ingest**: 3 Multi-Location-Calls × 288/Tag = 864 Requests/Tag. Weit unter dem ~10 000/Tag Free-Tier.
- **Migration**: Falls Frontend während Roll-Out alte `phase1`/`phase2`-Felder liest → kurzer Übergang mit beiden Feldnamen befüllt, oder Atomic Deploy von Skript+Worker zusammen.
