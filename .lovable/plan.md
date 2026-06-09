# Statisches Embed: Titel entfernen, Symbole vergrössern

## Ziel
Die kompakte, JavaScript-freie Wetter-Einbettung (`/api/public/embed/region-lokal-static`) anpassen, damit sie noch besser in die TWINT-Spalte passt und die Symbole deutlicher lesbar sind.

## Änderungen

### 1. Kopfbereich entfernen
In `src/routes/api/public/embed/region-lokal-static.ts`:
- Den kompletten `<header class="head">`-Block (Titel «Lokalprognose Amriswil» + Quellenzeile «Open-Meteo · MeteoSchweiz») entfernen.
- Das `<main class="page">`-Padding oben von `8px` auf `4px` reduzieren, damit kein visuelles Loch entsteht.

### 2. Symbole vergrössern
In derselben Datei:
- **Aktuell-Block:** Symbol-Grösse von `44 px` auf `56 px`, Temperatur-Schrift von `24 px` auf `28 px` erhöhen.
- **Stundentabelle:** Symbol-Grösse von `20 px` auf `28 px` erhöhen.
- **7-Tage-Tabelle:** Symbol-Grösse von `20 px` auf `28 px` erhöhen.
- CSS-Anpassungen: `.sym`-Spaltenbreite in beiden Tabellen von `32 px` auf `38 px` erhöhen, damit die grösseren SVGs nicht abgeschnitten werden.

## Dateien
- `src/routes/api/public/embed/region-lokal-static.ts` (HTML/CSS-String im `renderStaticForecast`-Generator)

## Nicht betroffen
- Interaktive Route `/embed/region-lokal`
- Embed-Info-Seite und Snippet (`src/routes/embed-info.tsx`)
- Datenquelle & Caching-Header