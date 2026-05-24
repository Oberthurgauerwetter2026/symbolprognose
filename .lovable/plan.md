Die Marker-Pills auf der Wetterkarte (Region) sollen zweifarbig gestaltet werden, um visuell zur Lokalprognose (hellblau Hintergründe) zu passen.

Änderung in `src/components/region-map.tsx` — ausschließlich `MarkerPill` Komponente:

1. **Hintergrund**: Statt `background: BRAND` (`#2561a1`) → `background: #fff` (weiß) oder eine sehr helle Blautönung (`var(--accent-soft)` im CSS style als `color-mix` / `oklch`).
2. **Akzentleiste**: Kleine farbige Markierung (z. B. 3px breiter Streifen links oder ein farbiger unterer Rand/Border in `accent-strong` `#1c4d82`) als visuelle Klammer zum Blau der Lokalprognose.
3. **Text-Farben**: Ortsname in `var(--accent)` (`#2561a1`), Temperatur-Zahlen in `var(--zinc-900)` (dunkelgrau, nicht mehr weiß).
4. **Icon**: WeatherIcon bleibt unverändert, passt sich automatisch an.
5. **Border / Schatten**: Dezenter Border in `var(--accent)/25%` oder `var(--zinc-200)`, plus weicherer Schatten, damit die weiße/hellblaue Pill auf dem hellen Kartenbild (OpenStreetMap) nicht „verschwindet".

Konkret vorgeschlagenes Design (Option C):
- Pill-Hintergrund: `var(--accent-soft)` (`#e8f0f9`)
- 3px linker Akzentstreifen in `var(--accent-strong)` (`#1c4d82`) — stattdessen ein kleiner farbiger Chip oder ein farbiger unterer Rand, damit es kein Layout-Shift gibt.
- Alternativ (einfacher): Pill-Hintergrund weiß mit `border: 1.5px solid var(--accent)` und `box-shadow: 0 2px 10px color-mix(in oklab, var(--accent) 15%, transparent)`.
- Text: `var(--zinc-900)` für Temperatur, `var(--accent)` für Ortsnamen, `var(--zinc-600)` für Min-Temperatur.

Nicht angefasst:
- Tooltip/Flyout, Leaflet-Konfiguration, Slider, Wochentags, Wetterdaten-Logik.