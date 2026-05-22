## Ziel
Die Wetter-Icons (Sonne, Wolke, etc.) sind an einigen Stellen zu klein, um auf einen Blick erkennbar zu sein. Sie sollen etwas grösser dargestellt werden.

## Identifizierte Stellen

1. **Karten-Marker (`src/components/region-map.tsx`)**
   - Aktuell: `WeatherIcon size={30}` in einem 40×40 px weissen Kreis
   - Plan: Icon auf 36 px vergrössern. Den umgebenden Kreis auf 46×46 px anpassen, damit das Icon nicht am Rand stösst.

2. **Tagesübersichts-Streifen (`src/components/weather-widget.tsx` DayStrip)**
   - Aktuell: `WeatherIcon size={72}`
   - Plan: Auf 80 px vergrössern.

3. **Stündliche Detail-Ansicht (`src/components/weather-widget.tsx` DetailPanel)**
   - Aktuell: `WeatherIcon size={cadence === "1h" ? 40 : 56}`
   - Plan: Auf 48 px (1h) bzw. 64 px (3h) vergrössern.

## Umsetzung
- Pure CSS/Prop-Änderungen, keine neuen Abhängigkeiten.
- Keine Logik-Änderungen, nur visuelle Anpassung.