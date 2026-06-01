## Diagnose
Im Screenshot zeigt 15:00 Uhr 2.9 mm Niederschlag bei 100 % Wahrscheinlichkeit, das Icon ist aber nur eine Wolke (WMO-Code 3 = bedeckt). Zwei Ursachen:

1. **Icon-Picker ignoriert Niederschlag**: `WeatherIcon` mappt 1:1 vom WMO-`weathercode` — wenn das Modell „bedeckt" liefert, aber gleichzeitig 3 mm Regen prognostiziert, gewinnt der `weathercode` und das Regen-Icon bleibt aus.
2. **Bewölkungsgrad fehlt als Signal**: Aktuell wird `cloud_cover` nicht abgefragt; jede Bewölkung > „leicht bewölkt" wird vom Modell direkt zu `weathercode: 3` (komplett überzogen) zusammengefasst.

## Vorgeschlagene Änderungen

### 1. Icon-Override bei Niederschlag (sofort wirksam, klein)
**`src/components/weather-icons/index.tsx`** — `WeatherIcon` um optionale Felder erweitern:

```tsx
export function WeatherIcon({
  code, isDay = true, size = 48, className,
  precip,         // mm in dieser Stunde (oder mm/h)
  precipProb,     // 0–100
  isSnow,         // optional: Schnee-Hinweis (z. B. Temperatur < 1 °C)
}) {
  // Override: klar prognostizierter Niederschlag schlägt den Bewölkungscode
  const wet = (precip ?? 0) >= 0.2 || (precipProb ?? 0) >= 60;
  if (wet && !(code >= 51 && code <= 99)) {
    if (isSnow) return <IconSnow .../>;
    if ((precip ?? 0) >= 1.5 || (precipProb ?? 0) >= 80) return <IconRain .../>;
    return <IconDrizzle .../>;
  }
  // ... bestehender Switch
}
```

**`src/components/weather-widget.tsx`** — beim Aufruf `precip` + `precipProb` + ggf. `isSnow` mitgeben (Hourly & Daily-Block, je 1 Stelle).

### 2. `cloud_cover` als Signal nutzen (für „zu pessimistisch")
**`src/lib/weather.ts`** — `cloud_cover` zur Hourly-Liste hinzufügen (`hourly`-Parameter beim Open-Meteo-Request: `"cloud_cover"`), als `number[]` durch alle Merge-/Ensemble-Pfade durchschleifen.

**`src/components/weather-icons/index.tsx`** — im Picker bei Code 3 (bedeckt) abstufen, sofern `cloudCover` mitgegeben wird:
- `cloudCover ≥ 87` → `IconCloudy` (wie bisher)
- `70–86` → `IconPartlyCloudy`
- `< 70` → `IconMostlyClear`

Damit wird ein häufiger Modellfehler („alles als bedeckt taggen") visuell korrigiert, ohne die Modellzahlen zu verfälschen.

### 3. Daily-Aggregation
Für den Tages-Block (`d.weathercode[i]`) zusätzlich `precipitation_sum` und ein neu zu holendes `cloud_cover_mean` (Open-Meteo Daily) als Hints durchreichen.

## Was nicht geändert wird
- Modelldaten/Forecast bleiben unverändert; nur die Icon-Wahl wird robuster.
- Temperatur, Wind, Niederschlagsbalken bleiben unangetastet.
- Keine Änderung am Region-Wetter-Tooltip.

## Rückfrage
Setze ich **nur Schritt 1** um (schneller Fix, Regen-Icon erscheint zuverlässig) oder **1 + 2 + 3** zusammen (vollständige Lösung inkl. abgestufter Bewölkung)?