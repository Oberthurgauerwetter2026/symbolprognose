# ICON-CH1/CH2 → ICON-seamless

Ziel: In der Symbol- und Lokalprognose werden die Open-Meteo-Modelle `meteoswiss_icon_ch1` und `meteoswiss_icon_ch2` durch `icon_seamless` ersetzt. Damit kommt **eine** zeitlich nahtlose ICON-Quelle (CH1 → CH2 → ICON-EU/global) statt zweier manuell zusammengeführter Streams.

## Wichtig vorab — Konsequenzen

1. **icon_seamless ist deterministisch**, kein Ensemble. Die heutige Logik in `src/lib/weather.ts` benutzt für CH1/CH2 die **EPS-Mittelwerte** (`fetchEnsembleMean`). Beim Wechsel auf `icon_seamless` fällt die Ensemble-Glättung weg → Symbole können stundenweise „nervöser" werden, Gewittercodes (95/96/99) erscheinen häufiger ungedämpft. Der bestehende Thunder-Overlay-Mechanismus bleibt wirksam.
2. **`minutely_15` liefert `icon_seamless` nicht** — nur `hourly`. Die 15-Minuten-Schiene in `scripts/ingest_openmeteo.py` (Phase 1, Felder `precipitation,snowfall` im 15-Min-Takt) muss entweder
   - **(a)** auf `meteoswiss_icon_ch1` bleiben (empfohlen — wird für die Lokalprognose-Nowcast-Kurve gebraucht), oder
   - **(b)** entfallen.
   
   Vorschlag: **(a)** — Phase 1 behält CH1 nur noch für `minutely_15`; alle Hourly-Felder wandern auf `icon_seamless`.
3. **`wind_speed_700hPa` / `wind_direction_700hPa`** sind in `icon_seamless` verfügbar (CH1/CH2-basiert in den ersten 5 Tagen), aber ab Tag 6 (ICON-EU/global) auf gröberem Grid. Für die aktuelle Reichweite (+120 h) unkritisch.
4. **Tag 6–7** kommt bei `icon_seamless` aus ICON-EU/global (6–13 km). Das ersetzt im EPS-Fallback aktuell `ecmwf_ifs025`. MOSMIX bleibt unverändert als priorisierte Quelle ab Tag 6.

## Änderungen

### 1. `scripts/ingest_openmeteo.py`
- **Phase 1** (CH1): `minutely_15` bleibt mit `meteoswiss_icon_ch1`. Hourly-Block (`wind_speed_700hPa, wind_direction_700hPa, wind_*_10m, wind_gusts_10m, precipitation`) wird aus Phase 1 entfernt.
- **Phase 2** (CH2 hourly): wird durch **neue Phase 2** mit `models=icon_seamless` ersetzt. Felder: `precipitation,snowfall,wind_speed_10m,wind_direction_10m,wind_gusts_10m,wind_speed_700hPa,wind_direction_700hPa`, `past_hours=12`, `forecast_hours=168` (decken Tag 7 ab, ersetzt damit auch die Lücke zwischen CH2-Horizont 120 h und MOSMIX/IFS).
- **Phase A** (Multi-Modell-Symbol-Aggregat, Zeile 258): `meteoswiss_icon_ch2` → `icon_seamless` im Modell-String. Die anderen Modelle (`icon_d2,arpege_europe,meteofrance_arome_france_hd,ecmwf_ifs025,gfs_global`) bleiben.

### 2. `src/lib/weather.ts` (`fetchForecast`)
- `fetchEnsembleMean(..., "meteoswiss_icon_ch1")` und `..."meteoswiss_icon_ch2"` werden ersetzt durch **eine** deterministische Abfrage `fetchModel(lat, lon, "icon_seamless")` über 168 h.
- `sliceEnsembleHourly` / `wrapEnsembleAsForecast` für CH1/CH2 entfallen.
- Neue Primärquellen-Kaskade: `icon_seamless` → `ecmwf_ifs025` (EPS bleibt als Fallback) → `best_match`.
- MOSMIX-Overwrite ab Tag 6 und Thunder-Overlay bleiben unverändert.
- Typ `EnsembleModel` wird auf `"ecmwf_ifs025"` reduziert; `ENSEMBLE_MEMBER_COUNT`-Einträge für CH1/CH2 entfernt.

### 3. `src/lib/forecast-aggregated.functions.ts`
- `CACHE_MODEL_SUFFIXES`: `"meteoswiss_icon_ch2"` → `"icon_seamless"` (damit `pickArr` weiterhin Modell-suffixed Felder aus dem Phase-A-Cache findet).

### 4. Dokumentations-/Kommentar-Updates
- Header-Kommentar in `src/lib/forecast.functions.ts` (Zeile 11) von `icon_ch2` → `icon_seamless`.
- Inline-Kommentare in `weather.ts` (Zeilen 687–689) und `ingest_openmeteo.py` (Zeilen 201–222) entsprechend anpassen.

## Nicht betroffen

- **MOSMIX**-Logik (Tag 6+ Override, DWD-Stations-Auswahl).
- **Radar/Niederschlags-Ingest** (`scripts/ingest_radar.py` — MeteoSchweiz CombiPrecip).
- **AROME**, **IFS-EPS**, **best_match** als Fallback-Quellen.
- UI-Komponenten (`weather-widget.tsx` etc.) — Datenstruktur bleibt identisch.

## Verifikation nach Build

1. GitHub-Action `openmeteo-ingest.yml` manuell triggern → R2 `openmeteo/forecast.json` prüfen: enthält `_icon_seamless`-suffixed Felder, keine `_meteoswiss_icon_ch1/ch2` mehr in Phase A.
2. Symbolprognose Region & Lokalprognose laden — keine Lücken in den ersten 33 h und nahtloser Übergang nach Tag 5.
3. Browser-Network: keine Direkt-Calls an `api.open-meteo.com` mit `meteoswiss_icon_ch1/ch2`.
