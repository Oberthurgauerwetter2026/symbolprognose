## Plan

Aktuell wählt `WeatherIcon` das Symbol fast nur aus dem WMO-Weathercode. Bei Open-Meteo wird `weathercode = 3 (bedeckt)` häufig auch bei dünner, hoher Bewölkung mit viel Sonne geliefert — das Icon zeigt dann eine volle Wolke, obwohl die Stunde 50–60 min Sonnenschein hat. Lösung: **`sunshine_duration` als Korrektiv** in die Symbol-Wahl einbauen, sowohl stündlich als auch für die Tageskachel.

### Änderungen

1. **`WeatherIcon` (`src/components/weather-icons/index.tsx`)**
   - Neue Prop `sunshineRatio` (0–1): Anteil Sonne an der Slot-Dauer.
   - Wenn der Code „bedeckt/teils bewölkt" ist (`2` oder `3`) UND es **nicht** nass/Nebel/Schnee/Gewitter ist:
     - `sunshineRatio ≥ 0.7` → `IconClear` / `IconClearNight`
     - `sunshineRatio ≥ 0.4` → `IconMostlyClear`
     - `sunshineRatio ≥ 0.15` → `IconPartlyCloudy`
     - sonst Symbol unverändert (bleibt `IconCloudy`)
   - Override wirkt nur tagsüber (für Nachtstunden kein Sonnen-Override).

2. **Stündliche Slots (`src/components/weather-widget.tsx`, ~Z. 861)**
   - `sunshineRatio = h.sunshine_duration[idx] / (cadence === "1h" ? 3600 : 3*3600)` an `WeatherIcon` übergeben.
   - Für 3h-Blöcke gemittelt über die 1–3 Stunden des Blocks.

3. **Tageskachel (`DayStrip`, ~Z. 535)**
   - `sunshineRatio = daily.sunshine_duration[i] / (Tagstunden 06–21 × 3600 = 54 000 s)` (entspricht dem neuen Aggregationsfenster).
   - Schwellen identisch zur stündlichen Variante.

### Auswirkungen

- Im Screenshot würden 14:00–19:00 (54–60 min Sonne) statt Vollwolke ein „mostly clear"-/Sonne-leicht-bewölkt-Symbol zeigen.
- Tage mit hoher Tagessonnen-Summe und gleichzeitig hohem Modus-Code (3) erscheinen nicht mehr als reine Bewölkung.
- Nass-Codes (Regen, Schnee, Nebel, Gewitter) bleiben unverändert; der Override greift bewusst nur bei „trockener" Bewölkung.