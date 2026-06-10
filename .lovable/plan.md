# Lokalprognose Amriswil: gleiche Icons wie Symbolprognose

## Problem
Die statische HTML-Route `/api/public/embed/region-lokal-static` (für das WordPress-Snippet "Lokalprognose Amriswil") zeichnet ihre Wettersymbole mit einer eigenen, vereinfachten Inline-SVG-Funktion (`weatherSymbol()` in `region-lokal-static.ts`). Diese Symbole sehen anders aus als die `WeatherIcon`-Komponente, die überall sonst in der Symbolprognose verwendet wird (z. B. in `/karten/lokal`).

Ziel: Im Amriswil-Snippet exakt dieselben Symbole wie in der allgemeinen Symbolprognose anzeigen — inklusive der Auswahllogik (Sonne mit Schauer, Gewitter mit Sonne, „heiter" vs. „bewölkt" über Cloud-Layer-Anteile, Schnee-Override etc.).

## Lösungsansatz
Die React-`WeatherIcon`-Komponente (`src/components/weather-icons/index.tsx`) kann nicht direkt in einer reinen HTML-Response gerendert werden, ohne das React-Bundle in das Snippet zu ziehen — was den ganzen Sinn der Monitor-stabilen, JS-freien Route zunichte machen würde. Stattdessen wird die SVG-Ausgabe **server-seitig als HTML-String** repliziert, mit identischer Optik (gleiche Pfade, gleiche `--wx-*`-Farbtokens) und identischer Auswahllogik.

## Schritte

1. **Neue Datei `src/lib/weather-icon-svg.server.ts`**
   - Portiert die SVG-Primitiven aus `weather-icons/index.tsx` (`Sun`, `Moon`, `Cloud`, `Drop`, `Flake`, `Bolt`) 1:1 als Template-Strings (gleiche Pfade, gleiche Farben über `var(--wx-*)`).
   - Portiert die Icon-Varianten: `Clear`, `ClearNight`, `MostlyClear`, `PartlyCloudy`, `Cloudy`, `Fog`, `Drizzle`, `Rain`, `Snow`, `Thunderstorm`, `SunShower`, `SunThunder`, `SunSnowThunder`, `SnowThunder`.
   - Portiert die Dispatcher-Logik aus `WeatherIcon` (gleiche Reihenfolge, gleiche Schwellen): Schnee/Regen-Override, Daily-Gewitter-Stufen, Cloud-Stockwerke (low/mid/high) vs. Cirrus, Sonnen-Korrektiv über `sunshineRatio`, Sonnenschauer.
   - Exportiert `renderWeatherIconSvg(opts) => string` mit derselben Prop-Signatur wie `WeatherIcon`.

2. **`src/components/embeds/lokal-noscript.tsx` (Typ-Erweiterung)**
   - `LokalNoscriptData` um die für die Icon-Auswahl nötigen Felder erweitern, jeweils optional:
     - pro Stunde: `precipProb`, `isDay`, `isSnow`, `cloudLow`, `cloudMid`, `cloudHigh`, `sunshineRatio`
     - pro Tag: `precipHours`, `thunderHours`, `sunshineRatio`, `isSnow`
     - in `current`: `isDay`, `cloudLow/Mid/High`, `sunshineRatio`, `isSnow`
   - Reine Typ-Erweiterung; der bestehende `LokalNoscript`-React-Renderer bleibt unverändert.

3. **`src/lib/embed-noscript.server.ts` (Datenanreicherung)**
   - Zusätzlich aus `getAggregatedForecast` lesen: `is_day`, `cloud_cover_low/mid/high`, `sunshine_duration`, `precipitation_probability`, `snowfall` (stündlich), sowie tagesweise `precipitation_hours`, `thunderstorm`/Wettercode-basierte Stunden, `sunshine_duration`.
   - Für jede ausgegebene Stunde / jeden Tag / `current` die Felder aus Schritt 2 berechnen (`sunshineRatio = sunshine_duration / 3600` für stündlich; für daily aus Summe geteilt durch Tageslicht-Sekunden, analog zur bestehenden Logik in der App).
   - Falls einzelne Quellen fehlen: Feld bleibt `undefined`, das Icon-Dispatcher verhält sich dann wie der heutige WMO-Fallback.

4. **`src/routes/api/public/embed/region-lokal-static.ts` (Snippet-Renderer)**
   - `weatherSymbol()` entfernen.
   - Stattdessen `renderWeatherIconSvg()` aus Schritt 1 mit allen jetzt verfügbaren Feldern aufrufen (für `current`, jede Stunde, jeden Tag; `scope: "hourly"` bzw. `"daily"`).
   - Im `<style>`-Block die `--wx-*`-Farbtokens definieren (1:1 aus `src/styles.css` Zeilen 85–100 kopiert), damit `currentColor`/Variablen funktionieren — die Route hat kein Tailwind/Theme.
   - Spaltenbreite `sym` ggf. leicht erhöhen (z. B. 44–48 px), damit die feineren neuen Icons nicht abgeschnitten werden; Tabellen-Layout sonst unverändert.

## Nicht-Ziele
- Keine Änderung am React-`/karten/lokal`-Erlebnis.
- Keine Änderung an anderen Embed-Snippets (Wind, Radar, Region etc.).
- Keine Änderung am `/embed/region-lokal`-noscript-React-Renderer — der bleibt textbasiert, weil er nur als Fallback im `<noscript>` läuft.

## Technische Details
- **Identische Optik durch Token-Wiederverwendung**: Die Variablen `--wx-sun`, `--wx-cloud`, `--wx-rain` etc. werden inline im `<style>` der Response definiert, exakt wie in `src/styles.css`. So sehen die SVGs pixelgenau aus wie in der App.
- **`viewBox` bleibt `0 0 64 64`** (wie im React-Set), nicht mehr `0 0 24 24` wie die alten Inline-Symbole. Das `width`/`height`-Attribut steuert die Darstellungsgröße.
- **Keine zusätzliche Bundle-Last**: Die neue Datei ist `*.server.ts` und wird nur in der Server-Route importiert.
- **Build-Sicherheit**: Reine String-Konkatenation, keine JSX, keine Worker-inkompatiblen APIs.
