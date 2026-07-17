## Ziel

Lokalprognosen zeigen für hochgelegene Orte (Säntis, Alpstein, Speer, Hörnli …) realistische Höhentemperaturen statt der Talwerte des jeweils nächsten Oberthurgau-Spots.

## Ursache

`getAggregatedForecast` in `src/lib/forecast-aggregated.functions.ts` wählt aktuell:

1. Nächsten Punkt aus **8 MCH-Spots** (alle Oberthurgau-Tal) — ohne Höhen-Check.
2. Fallback: nächsten Punkt im **22×36 Open-Meteo-Grid** (~7 km) — ohne Höhen-Check.

Beide Quellen liefern für Säntis (2502 m) die Werte eines Talpunkts (~500 m). Erst der ungenutzte Last-Resort-Pfad `fetchForecast(lat, lon)` würde Open-Meteos DEM-Downscaling (Höhen-abhängige Lapse-Rate) an der echten Koordinate anwenden.

## Fix

**Konzept:** Wenn der nächste MCH-/phaseA-Cache-Punkt zu weit weg **oder** höhenmässig zu unterschiedlich ist, direkt Open-Meteo für die echte Koordinate anfragen (via `fetchForecast`) — der Endpoint kennt die DEM-Höhe des angefragten Punkts und korrigiert die 2-m-Temperatur automatisch.

### Änderungen

`src/lib/forecast-aggregated.functions.ts`

1. **Distanz-Gate für MCH:** In `forecastFromMchCache`, nach `pickNearestMch`, den Abstand zum Ziel berechnen. Wenn > **~5 km** (Haversine), MCH ablehnen (`return null`), damit der Handler weiterfällt.
2. **Distanz-Gate für phaseA:** Analog in `forecastFromCache` — Grid-Abstand > **~4 km** ⇒ `return null`.
3. **Direct-Fetch als Höhen-korrekter Pfad:** Wenn beide Gates ablehnen, wird `fetchForecast(lat, lon)` (bereits vorhanden, letzter Zweig im Handler) aufgerufen. Er läuft serverseitig auf der Worker-IP und ist über den bestehenden CDN-Cache (`s-maxage=300`) günstig.
4. **Kleiner In-Memory-Guard** im Handler: Ergebnisse von `fetchForecast` pro gerundetem `lat/lon` (4 Dezimalstellen, bereits so validiert) für 5 min im Modul-Scope cachen, damit wiederholte Widget-Renders und Prefetches nicht Open-Meteo-Rate-Limits triggern.

### Warum nicht per Lapse-Rate korrigieren

Eine feste `-0.65 °C/100 m` wäre nur bei mittlerer Troposphäre gültig; Inversionen (Nebeltage) würden Talstationen kälter als den Berg zeigen — dann wäre die Korrektur falsch herum. Open-Meteo/ICON macht diese Physik bereits korrekt am echten Gitterpunkt inkl. DEM.

### Warum nicht neue Bergspots ins MCH-Ingest aufnehmen

MCH `local_forecast` bedient nur die per `SPOTS` ausgewählten Gemeindepunkte und liefert bewusst die dortige Höhe. Auf Bergpunkte umlenken ist keine offizielle Nutzung — der direkte Open-Meteo-Call ist der saubere Weg.

## Verifikation

1. `getAggregatedForecast({ lat: 47.25, lon: 9.333 })` (Säntis) liefert im November plausible Werte deutlich unter 0 °C statt Talwerte um 10 °C.
2. Amriswil (47.5428, 9.2871) liefert weiterhin unverändert die MCH-Werte (Abstand < 5 km → MCH bleibt Primärquelle).
3. Konsole-Log `[aggregated-forecast] all caches missed …` erscheint für Säntis, nicht für Amriswil.

## Was NICHT geändert wird

- `scripts/ingest_mch_local_forecast.py`, `SPOTS`-Liste, MCH-Icon-Mapping.
- `openmeteo-ingest.yml`, Rate-Limits, Grid-Auflösungen.
- Widget-UI, Symbol-Logik, Radar-/Wind-Karten.