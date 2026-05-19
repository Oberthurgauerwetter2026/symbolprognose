## Ziel
Emoji-Wettersymbole durch einheitliche, gerätegeunabhängige **SVG-Icons im Instrumental-Swiss-Stil** ersetzen — präzise, technisch, monochrom mit rotem Akzent. Konsistenter Look auf allen Geräten (iOS/Android/Windows/Linux).

## Designprinzipien
- **Stil**: dünne Linien (1.5 px Stroke), geometrisch, klar — passend zu MeteoSchweiz/SRF Meteo-Ästhetik
- **Farbe**: `currentColor` für Strich → erbt Textfarbe (zinc-900 light / zinc-50 dark)
- **Akzent**: Blitz, Warnungen und intensive Niederschläge optional in `--accent` (#e62117)
- **Grösse**: skaliert via `width`/`height` Props (z. B. 48 px in Tagesübersicht, 24 px in Stundenansicht)
- **Sonne/Mond**: gefüllter Kreis mit Strahlen / Mondsichel — Tag/Nacht-Variante via `isDay`

## Icon-Set (WMO-Codes → Komponente)
| Komponente | WMO-Codes |
|---|---|
| `IconClear` (Sonne/Mond) | 0 |
| `IconMostlyClear` (Sonne+kleine Wolke) | 1 |
| `IconPartlyCloudy` (Sonne+Wolke) | 2 |
| `IconCloudy` (Wolke) | 3 |
| `IconFog` (Wolke+Linien) | 45, 48 |
| `IconDrizzle` (Wolke+kleine Tropfen) | 51–57 |
| `IconRain` (Wolke+Tropfen) | 61–67, 80–82 |
| `IconSnow` (Wolke+Schneeflocken) | 71–77, 85, 86 |
| `IconThunderstorm` (Wolke+Blitz rot) | 95–99 |

## Umsetzung

### 1. Neuer Ordner `src/components/weather-icons/`
- `index.tsx` — exportiert `<WeatherIcon code={n} isDay={true} size={48} />`
- Jede Variante als kleine React-Komponente mit `<svg viewBox="0 0 64 64">…</svg>`
- Stroke via `stroke="currentColor"` `stroke-width="1.5"` `fill="none"` `stroke-linecap="round"` `stroke-linejoin="round"`
- Akzent (Blitz): `className="text-accent"` auf dem entsprechenden `<path>`

### 2. `src/lib/weather.ts`
- `weatherSymbol()` (Emoji-Funktion) bleibt als Fallback bestehen, wird aber in der UI nicht mehr verwendet
- Neue Hilfsfunktion `weatherIconKey(code)` die einen Komponenten-Key zurückgibt — alternativ direkt in `<WeatherIcon>` mappen

### 3. `src/components/weather-widget.tsx`
- Ersetze alle Stellen, wo `weatherSymbol(...)` als Text gerendert wird, durch `<WeatherIcon code={...} isDay={...} size={...} />`
- Tagesübersicht: `size={56}`
- Stundenansicht: `size={28}`
- Aktueller Tag/Stunde: optionaler Hover-/Active-Akzent

### 4. Tag/Nacht-Logik
- Tagesübersicht: immer Tag-Variante (Symbol für ganzen Tag)
- Stundenansicht: `isDay` aus `sunrise`/`sunset` der jeweiligen Stunde ableiten — `time >= sunrise && time < sunset`

## Nicht im Scope
- Animationen der Icons (statisch, performant fürs Embed)
- Wind-/Niederschlags-Diagramme
- Änderungen an Datenfetching, Layout oder Farben

## Visueller Effekt
Nach Umsetzung wirkt die Übersicht ruhiger und „instrumenten-artiger" — wie ein technisches Cockpit statt bunter Emoji-Mix. Identischer Look auf Mac, Windows, Android und iOS.
