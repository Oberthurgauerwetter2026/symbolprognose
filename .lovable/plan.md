## Plan: MCH-Original-Wettercodes (1–35 Tag / 101–135 Nacht) durchreichen

Ziel: Die MCH-Symbol-Nuancen (z. B. Code 30 = Hochnebel, 13/24/25/33 = unterschiedliche Gewitterspielarten, 26–29 = Spezial-Bewölkungsstufen) und die **modell-eigene** Tag/Nacht-Information nicht mehr im WMO-Mapping verlieren.

### 1. Ingest: MCH-Code zusätzlich speichern, nicht ersetzen

`scripts/ingest_mch_local_forecast.py`:
- Neues Feld `weathercode_mch` (raw, 1–199) in `hourly` und `daily` aufnehmen.
- Bestehendes `weathercode` (WMO) bleibt als Fallback erhalten — gemappt wie heute. Begründung: das Frontend hat viele WMO-basierte Heuristiken (Wet/Thunder/Shower-Overrides), die wir nicht doppelt pflegen wollen.
- Output-Schemaversion auf `mch-local-forecast-v2` hochziehen.

### 2. Typen + Cache

`src/lib/openmeteo-cache.server.ts`:
- `MchLocalForecastLocation.hourly` und `.daily` erhalten optional `weathercode_mch: (number | null)[]`.

`src/lib/weather.ts`:
- `HourlyData` und `DailyData` erhalten optional `weathercode_mch?: number[]`.
- Merge-Helfer (`mergeArr`, Aggregation) reichen das Feld 1:1 durch, ohne in die WMO-Logik einzugreifen.

### 3. Forecast-Builder

`src/lib/forecast-aggregated.functions.ts`, `buildForecastFromMchLoc`:
- `hourly.weathercode_mch` und `daily.weathercode_mch` aus dem MCH-Cache übernehmen.
- WMO bleibt parallel im Feld `weathercode` — andere Quellen (Open-Meteo-Fallback, MOSMIX-Anhang) setzen `weathercode_mch` nicht und der Code kennt das undefined.

### 4. Icon-Dispatcher

`src/components/weather-icons/index.tsx`:
- `<WeatherIcon>` bekommt optional `mchCode?: number`.
- Neuer Helper `resolveMchIcon(mchCode)`:
  - Erkennt Nacht aus dem Code selbst (≥ 100) → überschreibt `isDay`.
  - Mappt MCH-spezifische Codes auf die bestehenden Icon-Komponenten (z. B. 30 → `IconFog` mit Hochnebel-Variante falls vorhanden, 26–29 → differenzierte Cloudy/PartlyCloudy, 13/24/25/33 → Gewitter-Subtypen wie heute über `IconSunThunder`/`IconThunderstorm`).
  - Fällt auf den WMO-Pfad zurück, wenn der Code unbekannt ist.
- Wet/Thunder/Shower-Overrides (precip, sunshineRatio, thunderHours) bleiben unangetastet und greifen weiterhin auf Basis der Begleitfelder.

### 5. Konsumenten

`src/components/weather-widget.tsx` und alle Stellen, die `<WeatherIcon>` rendern:
- Beim Bauen der Props zusätzlich `mchCode={hourly.weathercode_mch?.[i]}` bzw. `daily.weathercode_mch?.[i]` durchreichen (undefined-safe).
- Footer-Quellenangabe bleibt.

### Nicht im Scope

- Eigene neue SVG-Icons für MCH-only-Symbole (Hochnebel, Schneegestöber-Subtyp). Falls gewünscht später als separater Schritt — vorerst reusen wir die bestehenden Icons.
- Änderung der Symbol-Map-/Aggregations-Logik (MOSMIX-Anhang, Gewitter-Override). Diese arbeiten weiter auf WMO.
- Open-Meteo-Pfad — der bleibt WMO-only.

### Verifikation

1. Nach Ingest-Lauf: `mch/local-forecast.json` enthält `weathercode_mch`-Arrays gleicher Länge wie `weathercode`.
2. Lokalprognose-Widget: Nachts wird Mond-Icon angezeigt auch ohne dass das Frontend die Sonnenstand-Heuristik braucht (sichtbar bei Spot Romanshorn 03:00).
3. Tag mit MCH-Code 30 (Hochnebel) zeigt Fog/Cloudy statt — wie bisher — Fallback „bewölkt".
4. Tag, an dem der MCH-Cache leer ist: Open-Meteo-Fallback rendert weiterhin identisch (kein Regressionseffekt).