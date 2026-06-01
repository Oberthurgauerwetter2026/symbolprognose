## Plan

Aktuell „verschluckt" der kategoriale Modus kleine Regenmengen: wenn zwischen 06–21 Uhr nur 1–2 Stunden Schauer fallen, dominiert der Trocken-Code und das Tages-Icon zeigt reine Wolken/Sonne. Lösung: **Niederschlag im Tagesfenster erzwingt mindestens ein Niederschlags-Symbol**, kombiniert mit Sonne, wenn der Tag insgesamt sonnig bleibt.

### Änderungen

1. **Neues Icon `IconSunShower`** in `src/components/weather-icons/index.tsx`
   - Sonne oben links, Wolke rechts unten, 2–3 Tropfen unter der Wolke.
   - Verwendet bestehende `Sun`, `Cloud`, `Drop` Bausteine.

2. **`WeatherIcon`-Dispatcher** (`src/components/weather-icons/index.tsx`)
   - Neuer Override **vor** dem normalen Code-Mapping, nur für `scope="daily"`:
     - Wenn `precipHours ≥ 1` ODER `precip ≥ 0.5 mm` (im Tagsfenster),
       und WMO-Code ist **nicht** bereits nass/Schnee/Gewitter/Nebel:
       - `sunshineRatio ≥ 0.3` → `IconSunShower` (Sonne + Wolken + Regen)
       - sonst → `IconDrizzle` (Wolken + Regen)
     - Wenn Code bereits nass ist, bleibt die bestehende Regen-/Schauer-Logik.
   - Sonnen-Aufhellung (clear/mostly-clear/partly) greift wie bisher — aber nur, wenn **kein** Regen im Fenster fällt.

3. **Daten-Pipeline** ist bereits passend
   - `aggregateDailyFromHourly` aggregiert `precipitation_sum` und `precipitation_hours` schon über 06–21 (vorherige Änderung). Diese Werte werden ans Tages-Icon übergeben — keine zusätzliche Aggregation nötig.

### Auswirkungen

- Tag mit 14 Std. Sonne + 1 Std. leichtem Schauer → `IconSunShower` statt nur Sonne/Wolken.
- Tag mit wenig Sonne + 2 Std. Schauer → `IconDrizzle` statt reine Wolke.
- Vollnasse Tage (Modus = Regen) bleiben `IconRain` über die bestehende Schwere-Schwelle (≥6 h oder ≥10 mm).
- Stündliche Icons unverändert.