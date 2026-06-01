## Plan

Die neuen Wetter-Symbol-Logiken (Sonnen-Aufhellung, Schauer-Override mit `IconSunShower`, Drizzle-vs-Rain-Schwellen) greifen aktuell nur im `WeatherWidget`. Auf den Karten-Markern (`region-map.tsx`, Region- und Lokalkarte) wird `WeatherIcon` ohne die nötigen Zusatz-Props aufgerufen — daher zeigen die Marker noch das alte, rein code-basierte Symbol.

### Änderung

**`src/components/region-map.tsx` (`SpotMarker` + `MarkerPill`)**

1. `MarkerPill`-Props um die zusätzlichen Wetterfelder erweitern und an `<WeatherIcon>` durchreichen:
   - `precip`, `precipProb`, `precipHours`, `isSnow`, `sunshineRatio`, `scope`.

2. In `SpotMarker` aus `data` extrahieren:
   - **Daily-Modus**:
     - `scope="daily"`
     - `precip = daily.precipitation_sum[dayIdx]`
     - `precipProb = daily.precipitation_probability_max?.[dayIdx]`
     - `precipHours = daily.precipitation_hours?.[dayIdx]`
     - `isSnow = (daily.snowfall_sum?.[dayIdx] ?? 0) > 0.1`
     - `sunshineRatio = (daily.sunshine_duration?.[dayIdx] ?? 0) / (15*3600)`
   - **Hourly-Modus**:
     - `scope="hourly"`
     - `precip = hourly.precipitation[absoluteHour]`
     - `precipProb = hourly.precipitation_probability?.[absoluteHour]`
     - `isSnow = (hourly.snowfall?.[absoluteHour] ?? 0) > 0.05`
     - `sunshineRatio = (hourly.sunshine_duration?.[absoluteHour] ?? 0) / 3600`

3. Werte im `useMemo`-Dependency-Array ergänzen, damit die Marker bei Datenwechsel neu rendern.

### Auswirkungen

- Region- und Lokalkarten-Marker zeigen dieselbe Logik wie die Tages-/Stundenkacheln: Sonne, Wolken, Sonne-Schauer-Kombi, Drizzle-vs-Rain — konsistent über das ganze Produkt.
- Keine Daten-Pipeline-Änderung nötig, `fetchForecast` liefert die Felder bereits.