## Plan

Open-Meteo liefert `cloud_cover_low`, `cloud_cover_mid`, `cloud_cover_high` (0–100 %). Diese drei Schichten werden in die Symbol-Logik aufgenommen, damit dünne, hohe Bewölkung nicht mehr als „bedeckt" dargestellt wird.

### Änderungen

1. **Daten-Pipeline (`src/lib/weather.ts`)**
   - `HOURLY_VARS` erweitern um `cloud_cover_low`, `cloud_cover_mid`, `cloud_cover_high` (nur `best_match`-Endpoint; Ensemble-APIs liefern sie nicht — `fillGaps` übernimmt sie aus `best_match`).
   - `HourlyData`-Typ + `sanitizeForecast` + `fillGaps` um die drei Felder ergänzen.
   - `aggregateDailyFromHourly`: Durchschnitt der drei Schichten über 06–21 berechnen und als `cloud_low_avg`, `cloud_mid_avg`, `cloud_high_avg` in den Daily-Aggregaten ablegen (neue Felder in `DailyData`).

2. **`WeatherIcon`-Dispatcher (`src/components/weather-icons/index.tsx`)**
   - Neue Props: `cloudLow`, `cloudMid`, `cloudHigh` (0–100).
   - Neue Heuristik, **bevor** das Code-Mapping greift (nur trockene Codes 0–3, kein Nass/Schnee/Nebel/Gewitter):
     - **Echte Bedeckung**: `cloudLow ≥ 60` → `IconCloudy` (auch wenn Code 2 wäre).
     - **Nur hohe Bewölkung** (Cirrus): `cloudLow < 30` und `cloudMid < 40` und `cloudHigh ≥ 40` → `IconMostlyClear` (Sonne scheint durch).
     - **Mittlere Bewölkung dominant**: `cloudMid ≥ 50` und `cloudLow < 50` → `IconPartlyCloudy`.
     - Sonnen-Korrektiv aus `sunshineRatio` bleibt als Fallback bestehen.

3. **Call-Sites**
   - `weather-widget.tsx` (Tageskachel + Stundenslots): `cloudLow/Mid/High` an `WeatherIcon` durchreichen (Daily aus Aggregaten, Hourly aus `h.cloud_cover_*`).
   - `region-map.tsx` (`SpotMarker` → `MarkerPill`): dieselben Felder durchreichen.

### Auswirkungen

- Tag mit nur Cirrus (hohe Wolken) und viel Sonne → `IconMostlyClear` statt `IconCloudy`.
- Tag mit dichten tiefen Stratus → `IconCloudy`, auch wenn der Code zufällig 2 wäre.
- Cumulus-/Mid-Bewölkung → `IconPartlyCloudy`.
- Konsistent in Region-Karte, Lokalkarte und stündlicher Prognose.