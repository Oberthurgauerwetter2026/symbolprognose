## Änderungen

### 1. 7-Tage-Prognose (statt 5)
- `src/lib/weather.ts`: `TOTAL_DAYS = 6` → `7` (Heute + 6 weitere = 7 Tage)
- `src/components/weather-widget.tsx`: `slice(0, 5)` → `slice(0, 7)`
- Skeleton-Grid: `md:grid-cols-5` → entfernt, ersetzt durch responsives Verhalten (siehe Punkt 3)

### 2. Symbole kontrastreicher + Mondsichel
In `src/styles.css` (Weather-Palette):
- `--wx-sun` heller, sättigender: `#f59e0b` → kontrastreich gegen helle Hintergründe
- `--wx-sun-core: #fbbf24`
- `--wx-cloud: #cbd0d8` (etwas dunkler, mehr Definition), `--wx-cloud-shade: #8a92a0`
- `--wx-cloud-dark: #4b5563`, `--wx-cloud-dark-shade: #1f2937` (kräftiger)
- `--wx-rain: #1d6fb8` (näher am Accent #2561a1, kräftiger als bisher)
- `--wx-snow-edge: #6b7a8c` (deutlich sichtbarer Snowflake-Outline)
- `--wx-fog: #4b5563` (statt #9ca3af — Nebellinien sichtbar)
- **Mondsichel**: `--wx-moon: #fef3c7` (warmes Creme), `--wx-moon-shade: #d97706` (Goldakzent für Schatten)

In `src/components/weather-icons/index.tsx`:
- `Moon`-Funktion: Schatten-Opacity von `0.25` → `0.5`, plus dünne Outline (`stroke` in moonShade) für klare Sichel-Kontur auch auf hellem Hintergrund
- `Cloud`-Funktion: dünne Outline (`stroke` in shade-Farbe, strokeWidth ~1) für Konturen-Definition
- `Sun`-Strahlen leicht länger (rayLen 0.55 → 0.7) für mehr Präsenz

### 3. Dynamisches/responsives Layout (Embed-tauglich)
**Problem**: 7 Tage × `md:min-w-0` auf `md:grid-cols-5` würde bei schmalen Embeds (z.B. 600 px Sidebar) zu eng werden.

**Lösung — Container-Query-basiert**:
- `WeatherWidget`-Wrapper bekommt `@container` (Tailwind v4 unterstützt nativ via `container-type: inline-size`)
- DayStrip: ersetzen von `md:grid-cols-5` durch Container-Query-Klassen:
  - Default: horizontaler Scroller mit `min-w-[140px]` pro Tag (kompakt)
  - `@[640px]`: Grid mit 4 Spalten + horizontaler Scroll für Rest
  - `@[900px]`: 7 Spalten als Grid, alle Tage gleichzeitig sichtbar
- `max-w-5xl` am Outer-Container bleibt für Standalone, aber: `max-w-full` Fallback damit Embed-iFrame nie überläuft
- Padding reduzieren bei kleinem Container (`p-3` statt `p-4` in Slots)
- Header: bei schmalen Containern Switch unter den Titel stacken (bereits via `flex-col md:flex-row` — Breakpoint auf Container umstellen)
- DetailPanel-Slot-Breite: `w-[128px]` → `w-[112px]` Default, `@[640px]:w-[128px]`

### 4. Skeleton anpassen
- `grid-cols-2 md:grid-cols-5` → `flex overflow-x-auto` mit 7 Karten, passend zum neuen Layout

## Technische Details

- Container-Queries: in Tailwind v4 verfügbar via `@container` Klasse + Variant `@[size]:`. Bereits Teil des Setups (Tailwind v4 + `tw-animate-css`).
- Alle Farb-Änderungen in `src/styles.css` als Tokens; keine Hex in Komponenten.
- API-Call mit `forecast_days=7` ist mit Open-Meteo `meteoswiss_icon_seamless` und `ecmwf_ifs025` problemlos (beide liefern bis 7+ Tage).
- Tag-6/7 nutzen weiter ECMWF IFS via bestehende Blend-Logik (`ECMWF_FROM_DAY = 4`).

## Nicht enthalten

- Keine Änderung an Datenquellen-Auswahl oder Modell-Blend-Schwellen
- Keine Änderung an Routing oder embed-info-Seite
