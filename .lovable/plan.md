## Plan

Die Tages-Aggregation in `aggregateDailyFromHourly` (src/lib/weather.ts) wird auf das Zeitfenster **06:00–21:00 Uhr (lokal)** eingeschränkt. Nachtstunden (00–05 und 22–23) fließen nicht mehr in Tages-Icon, Niederschlagssumme, nasse Stunden, Min/Max-Temperatur, Wind etc. ein.

### Änderungen

1. **`aggregateDailyFromHourly`** in `src/lib/weather.ts`
   - Beim Sammeln der Indizes für einen Tag zusätzlich filtern: nur Stunden mit `06 ≤ HH < 21` einbeziehen.
   - Stunde aus `h.time[i]` (ISO-String, lokal) auslesen.
   - Alle abgeleiteten Werte (weathercode, temp_max/min, precipitation_sum, precipitation_hours, wind, sunshine, snowfall) basieren auf demselben Fenster.

2. **Konsistenz**
   - `precipHours`-Schwelle für den „Schauer-vor-Regen"-Override entsprechend anpassen (aktuell `< 8` von 24 → neu `< 5` von 15 Tagstunden), damit der Override im neuen Fenster gleich aggressiv bleibt.

### Auswirkungen

- Tages-Symbol bildet realistisch den Wettercharakter zwischen Sonnenaufgang/Aktivzeit ab; nächtlicher Schauer macht aus einem teils-sonnigen Tag keinen „Regentag" mehr.
- Tages-`precipitation_sum` und `precipitation_hours` zeigen dann nur Tagstunden — das ist gewollt, da diese Werte auch das Icon und die Schwellen (`≥6h` / `≥10mm`) im Icon-Dispatcher steuern.
- Tageskachel im Beispiel „Amriswil, Di 2. Juni" sollte korrekt als Schauer/teils bewölkt statt Dauerregen erscheinen.