## Ziel

Ab Tag 6 zusätzlich DWD-MOSMIX (MOSMIX-L, 10-Tage-Statistikprognose des Deutschen Wetterdienstes) in den Forecast-Merge einbeziehen. Tag 1–5 bleibt wie heute (ICON-CH1 → ICON-CH2). Tag 6–7 wird neu zusätzlich mit MOSMIX gefüllt, statt nur ECMWF IFS.

## Hintergrund

- Aktuelle Quellen (in `src/lib/weather.ts`):
  - Stunde 0–24: MeteoSwiss ICON-CH1-EPS
  - Tag 2–5: MeteoSwiss ICON-CH2-EPS
  - Tag 6–7: ECMWF IFS Ensemble
  - `best_match` als Restfallback (Sunrise/Sunset, Probability)
- DWD-MOSMIX wird **nicht** von Open-Meteo bereitgestellt. Die Daten kommen direkt von `opendata.dwd.de` als KMZ (gezipptes KML mit Stundenwerten). Das Parsing erfordert serverseitige Logik (CORS, ZIP entpacken, XML parsen).

## Vorgehen

### 1. Server Function `fetchMosmix`
Neue Datei `src/lib/mosmix.functions.ts` mit `createServerFn`:
- Eingabe: nächstgelegene MOSMIX-Station-ID (oder lat/lon → Stationssuche)
- Lädt `https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/{STATION}/kml/MOSMIX_L_LATEST_{STATION}.kmz`
- Entpackt KMZ (zip) im Worker (Web `DecompressionStream` oder `fflate`)
- Parst KML, extrahiert benötigte Elemente: `TTT` (Temp K), `FF` (Wind m/s), `FX1` (Böen), `DD` (Windrichtung), `RR1c` (Niederschlag mm/h), `ww` (Wettercode SYNOP → WMO mapping), `SunD1` (Sonnenscheindauer s), `N` (Bewölkung %)
- Normalisiert auf das `HourlyData`-Schema (Temp K→°C, Wind m/s→km/h, SYNOP→WMO-Code)
- Cache: 1h, da MOSMIX nur ~4x täglich aktualisiert wird

### 2. Stationsauswahl
- Eingebettete Liste der ~50 wichtigsten MOSMIX-Stationen in CH/DE/AT mit lat/lon (statisch in der Server Function)
- Bei `fetchMosmix(lat, lon)` wird die nächste Station per Haversine gewählt
- Falls keine Station < ~30 km → `null` zurück (kein Merge)

### 3. Integration in `fetchForecast`
- `mosmixRaw` parallel zu den anderen Quellen laden
- In `wrapEnsembleAsForecast`-ähnlicher Form einbetten
- Merge-Reihenfolge im `fillGaps`:
  1. CH1 (Stunde 0–24)
  2. CH2 (bis Tag 5)
  3. **MOSMIX (ab Tag 6)** — neu eingefügt vor IFS
  4. IFS (Restfallback Tag 6–7)
  5. `best_match` (Sunrise/Sunset/Probability)
- Konkret: vor dem Merge wird MOSMIX auf Stunden ab Tag-6-Start (5×24 = 120h) zugeschnitten, damit es nicht in die ICON-Bereiche reinwirkt.

### 4. UI / Quellenanzeige
- In `weather-widget.tsx` die Quellen-Legende erweitern (falls vorhanden): „Tag 6–7: DWD-MOSMIX / ECMWF IFS"
- Keine sichtbare Layoutänderung sonst

### 5. Robustheit
- MOSMIX-Fetch in `try/catch`, bei Fehler einfach übersprungen → bisheriges Verhalten bleibt erhalten
- KMZ-Parse-Fehler werden geloggt, brechen den Forecast nicht ab

## Offene Punkte (kurz Rückfrage)

1. **Soll MOSMIX die Primärquelle ab Tag 6 sein** (statt IFS), oder nur als zusätzlicher Lückenfüller nach IFS?
   Empfehlung: **MOSMIX als Primär ab Tag 6**, IFS als Fallback — MOSMIX ist auf Stationsebene meist präziser.
2. **Geografische Abdeckung**: MOSMIX ist primär DE, hat aber auch CH/AT-Stationen. Bei Punkten ohne nahe Station (z. B. Innerschweizer Täler) → automatisch IFS. OK so?
