# Fix: Schneeflocken bei Plusgraden in der Symbolprognose

## Ursache

Der `isSnow`-Flag wird an mehreren Stellen allein aus `snowfall > 0.05 mm` (stündlich) bzw. `snowfall_sum > 0.1 mm` (täglich) abgeleitet. Open-Meteo/ICON melden aber „snowfall" auch dann, wenn der Niederschlag in höheren Luftschichten als Schnee fällt und am Boden längst als Regen ankommt (Schmelzgrenze weit oberhalb 2 m). Es existiert bisher nur im MCH-Pfad (`mchToIcon`) ein Temperatur-Gate — im generischen WMO-Pfad (`WeatherIcon`, `weather-icon-svg.server.ts`, Embed-Noscript, RegionMap) läuft `isSnow` ungeprüft durch und liefert `IconSnow` bei 18 °C.

## Änderungen

### 1. Zentrale Regel im WeatherIcon-Dispatcher (`src/components/weather-icons/index.tsx`)

Direkt am Anfang von `WeatherIcon` (und analog im MCH-Zweig weiter genutzt) einen einheitlichen Temperatur-Filter für `isSnow` einbauen:

- Stündlich: `isSnow` nur akzeptieren wenn `temp <= 2 °C` (bzw. `temp` unbekannt).
- Täglich: `isSnow` nur akzeptieren wenn `temp <= 3 °C` (Tagesmittel/Max heuristisch — hier reicht die bereits übergebene `temp`, sonst falsy).

Dieser gefilterte Wert (`snowActive`) ersetzt `isSnow` in allen nachfolgenden Zweigen (Gewitter mit Schnee, `wet && isSnow`, Schnee-Override Zeile 595, Daily-Fallbacks).

### 2. Server-SVG (`src/lib/weather-icon-svg.server.ts`)

Gleiche `snowActive`-Ableitung am Anfang von `renderWeatherIconSvg`. Die Funktion bekommt bereits `temp` (falls nicht: Signatur erweitern und Aufrufer in `embed-noscript.server.ts` durchreichen). Alle `isSnow`-Verwendungen dort werden auf `snowActive` umgestellt.

### 3. Embed-Noscript (`src/lib/embed-noscript.server.ts`)

Bei der Berechnung von `isSnow` an drei Stellen (Zeilen 67/83/142) zusätzlich `temperature_2m[i] <= 2` (stündlich) bzw. `temperature_2m_max[i] <= 3` (täglich) fordern. Temperatur an den Server-SVG-Aufruf weitergeben.

### 4. Widget & RegionMap

- `src/components/weather-widget.tsx` (Zeilen 667, 1137): `temp` mitgeben (bereits verfügbar via `d.temperature_2m_max[i]` bzw. `h.temperature_2m[idx]`) — der Temperatur-Filter in `WeatherIcon` greift dann automatisch.
- `src/components/region-map.tsx`: `temp` an `WeatherIcon` durchreichen, falls noch nicht geschehen.

### 5. MCH-Pfad

Der bereits vorhandene Gate in `mchToIcon` (Zeile 418ff.) wird beibehalten, aber leicht großzügiger: Schwelle für `pureSnow` von `t > 4` auf `t > 3` senken und für `mixCodes` von `t > 2` auf `t > 2` (unverändert). Damit alle Pfade konsistent bei ~2–3 °C umschalten.

## Nicht geändert

- Daten-Ingest (`snowfall`-Rohwerte bleiben unverändert im Cache; nur die Icon-Auswahl wird korrigiert).
- Niederschlagsmenge, Regenwahrscheinlichkeit, Charts.

## Verifikation

- Preview mit einem Ort öffnen, an dem in den nächsten Tagen 15–25 °C und `snowfall > 0` gemeldet werden (Screenshot des Users: Amriswil, `/karten/lokal`). Sicherstellen, dass keine Schnee-Icons erscheinen.
- Winter-Fall gegenprüfen: temp = −2 °C + snowfall → Schnee-Icon bleibt.
