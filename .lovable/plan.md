## Ziel
Monochrome Linien-Icons durch **farbige, gefüllte SVG-Icons im SRF-Meteo-Stil** ersetzen.

## Farbtokens (`src/styles.css`)
Ergänze unter `:root`:
- `--wx-sun: #f5b800`, `--wx-sun-core: #ffd84d`
- `--wx-moon: #fff1c2`, `--wx-moon-shade: #e8d895`
- `--wx-cloud: #d6d9de`, `--wx-cloud-shade: #a8adb5`
- `--wx-cloud-dark: #6b7280`, `--wx-cloud-dark-shade: #4b5563`
- `--wx-rain: #3b8fd1`
- `--wx-snow: #ffffff`, `--wx-snow-edge: #b8c5d3`
- `--wx-bolt: #facc15`, `--wx-bolt-edge: #f59e0b`
- `--wx-fog: #9ca3af`

## Icons (`src/components/weather-icons/index.tsx` — komplett neu)
- Gefüllte Paths statt Stroke; viewBox 64×64; `WeatherIcon`-Signatur unverändert
- Wolke = zwei übereinanderliegende Paths (heller Body + dunkler Schatten-Boden)
- Sonne = Scheibe + 8 Strahlen (kurze abgerundete Rechtecke)
- Mond = Sichelform für Nacht-Varianten
- Tropfen = Tear-Drop, blau
- Schneeflocke = 6-strahliger Stern, weiss mit Edge-Kontur
- Blitz = gelber Zickzack mit oranger Kante
- Sonne/Mond bei „mostly clear" und „partly cloudy" oben-links hinter der Wolke

## Mapping bleibt
0→Clear/ClearNight, 1→MostlyClear, 2→PartlyCloudy, 3→Cloudy, 45/48→Fog, 51–57/80–81→Drizzle, 61–67/82→Rain, 71–77/85–86→Snow, 95+→Thunderstorm.

## Nicht im Scope
- Animationen, Widget-Layout, Datenfluss, UI-Chrome-Farben.
