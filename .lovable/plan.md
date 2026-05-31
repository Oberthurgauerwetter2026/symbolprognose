# Messung & Prognose visuell angleichen

## Ursache

Die RGBA-Werte in `SCALE` (Forecast) und `PRECIP_SCALE` (Messungs-PNG) sind seit dem letzten Turn exakt gleich. Die sichtbare Differenz kommt **nicht** aus der Palette, sondern aus zwei nachgelagerten Frontend-Effekten:

1. **CSS-Filter nur auf der Messung** (`src/styles.css`):
   ```css
   .mch-precip { filter: saturate(1.5) contrast(1.25); }
   ```
   Die MCH-PNGs werden im Browser noch um +50% Sättigung und +25% Kontrast verschoben → kräftigere, dunklere Farben. Die Prognose-Canvas hat `filter: none` und bleibt bei den Rohpalettenwerten → wirkt blasser.

2. **Opacity-Unterschied** (`src/components/maps/radar-map.tsx`, ~Zeile 956):
   ```ts
   const opacityVal = isForecast ? 0.75 : 1;
   ```
   Forecast wird zusätzlich mit 0.75 multipliziert, Messung mit 1.0. Schon allein das macht die Forecast-Farben ~25% transparenter und damit heller über dem Basemap.

## Fix

Damit Messung und Prognose visuell identisch erscheinen, beide Effekte entfernen:

### A) `src/styles.css`
- `.mch-precip { filter: saturate(1.5) contrast(1.25); }` → Regel entfernen (oder `filter: none`).

### B) `src/components/maps/radar-map.tsx`
- `const opacityVal = isForecast ? 0.75 : 1;` → `const opacityVal = 1;`.

Beides zusammen: gleiche Palette × gleiches Alpha × gleiche Opacity × kein Filter → Messung und Prognose zeigen identische Farbe pro mm/h-Band.

## Nicht geändert

- `SCALE` / `colorFor` (bereits exakt).
- `PRECIP_SCALE` in `scripts/ingest_radar.py` (bereits exakt).
- Animation / Smoothstep / STEP=2 aus letztem Turn.

## Dateien

- `src/styles.css`
- `src/components/maps/radar-map.tsx`
