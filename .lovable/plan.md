## Problem

Im Daily-Icon-Dispatcher (`src/components/weather-icons/index.tsx`) ist die Schwelle für „Sonne im Schauer-Symbol" `sunshineRatio >= 0.25`. Für viele teils-sonnige Tage liegt der Tagessummen-Anteil (`sunshine_duration / 15h`) jedoch bei 0.15–0.22. Dann fällt das Icon auf `IconDrizzle`/`IconRain` (reine Wolke + Tropfen) zurück — obwohl die Stundenkacheln klar Sonne zeigen.

## Änderung (nur `src/components/weather-icons/index.tsx`)

1. **Hilfsfunktion** `pickWetDailyIcon({ sunshineRatio, precipHours, precip, isSnow })` einführen. Reihenfolge:
   - Schnee → `IconSnow`
   - `sunshineRatio >= 0.15 && precipHours < 8` → `IconSunShower`
   - `precipHours >= 8 && precip >= 15` → `IconRain`
   - sonst → `IconDrizzle`

2. **Diese Funktion an allen 5 Daily-Stellen verwenden**:
   - Wet-Override-Block (Z. ~381)
   - „dayHasRain"-Block (Z. ~396)
   - Code 61–67 daily (Z. ~458)
   - Code 80/81 daily (Z. ~466)
   - Code 82 daily (Z. ~473)

3. **Schwelle senken** von `0.25` → `0.15` für die Daily-Sonne. Hourly-Pfad bleibt unverändert.

## Nicht geändert

- Hourly-Pfad, Aggregator-Logik, kein Cache-Bump.

## Verifikation

- Amriswil / „Morgen": `sunshineRatio ≈ 0.2`, `precipHours ≈ 2` → `IconSunShower`.
- Voll bedeckter Regentag (`sunshineRatio < 0.1`, `precipHours ≥ 8`) → `IconRain`/`IconDrizzle`.
