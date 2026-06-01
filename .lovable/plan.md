## Gewitter-Override aus best_match / MOSMIX

**Problem:** `best_match` zeigt morgen 19 Uhr Code 95 (Gewitter, 5.8 mm), aber der Ensemble-Mittelwert glättet das zu 61/63. `thunderHours` zählt daher 0 → kein Gewittersymbol.

**Änderung in `src/lib/weather.ts`, Funktion `fetchForecast`:**

Nach allen Merges, **vor** `aggregateDailyFromHourly`:

1. Wenn `bestMatch?.hourly?.weathercode[i] ∈ {95,96,99}` → `merged.hourly.weathercode[i]` auf diesen Code setzen.
2. Analog für MOSMIX (`mosmixForecast.hourly.weathercode[i]`), wenn vorhanden.
3. Index-Mapping über `merged.hourly.time` (gleiche Zeitachse wie best_match dank gleicher `timezone=auto`-Quelle; MOSMIX ist bereits via `alignMosmixToTimeline` ausgerichtet).

Nur dieser eine Code wird überschrieben — alle anderen Felder (precip, temp etc.) bleiben Ensemble.

**Konsequenz:** `aggregateDailyFromHourly` zählt `thunderHours ≥ 1` korrekt, Tagessymbol zeigt Gewitter.

**Kein Cache-Bump nötig** (`v8` reicht — Datenstruktur unverändert), aber zur Sicherheit auf `v9` bumpen, damit Browser den alten Cache verwirft.

**Verifikation:** Amriswil / morgen → `daily.thunderstorm_hours[1] ≥ 1` → Gewitter-Icon in Tageskachel.
