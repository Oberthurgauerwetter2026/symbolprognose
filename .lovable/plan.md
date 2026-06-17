# Ziel

Wenn `weathercode_mch` vorhanden ist, soll das Frontend **genau das MeteoSwiss-Pictogramm** zur jeweiligen Code-Nummer rendern — keine Interpretation, keine Reduktion auf unsere generischen Icons, kein WMO-Umweg.

# Status heute

`pickMchIcon` in `src/components/weather-icons/index.tsx` (und Spiegelung in `weather-icon-svg.server.ts`) mappt die 35 MCH-Codes auf unser bestehendes generisches Icon-Set (Clear, PartlyCloudy, Rain, Snow, Thunderstorm, …). Das ist eine Heuristik: Schnee-Regen-Mix (6/8/18/23), Schauer (9/11/19/32), variabel bewölkt (28/29), Schnee-Gewitter (35) etc. werden auf Nachbarsymbole abgebildet, weil keine eigenen Komponenten existieren.

# Plan

## 1. MCH-Symbol-Set als Assets ablegen

- Set mit **70 SVGs** anlegen: `mch-01.svg` … `mch-35.svg` (Tag) und `mch-101.svg` … `mch-135.svg` (Nacht).
- Stil: dem aktuellen Vektor-Stil (Sonne/Mond, Wolken, Tropfen, Blitze) treu bleiben, aber **jeder Code ein eigenes Bild**, das exakt der MeteoSwiss-Pictogramm-Bedeutung entspricht (siehe Legende: Klar, leicht/mässig/dicht bewölkt, Nebel, Niesel, leichter/mässiger/starker Regen, Schnee, Schnee-Regen-Mix, Schauer, Gewitter, Schnee-Gewitter, variabel, Sturm).
- Ablage: `src/assets/mch-icons/` als echte SVG-Dateien (klein, <2 KB pro Stück → in Repo halten, kein CDN nötig). Wenn das Set später wächst, optional über `lovable-assets` auf CDN auslagern.
- Generierungsweg: SVGs werden von mir per Skript/Hand erstellt; **keine** Übernahme proprietärer MeteoSwiss-Bilddateien.

## 2. Komponente `MchPictogram`

- Neue Komponente in `src/components/weather-icons/mch-pictogram.tsx`:
  ```tsx
  <MchPictogram code={mchCode} size={48} className="…" />
  ```
- Intern: `import` aller 70 SVGs als URLs (Vite `?url`) in einer Lookup-Map `{ 1: url, 2: url, …, 135: url }`. Render als `<img src={map[code]} width={size} height={size} alt="" role="img" aria-label={mchLabel(code)} />`.
- Label-Tabelle `mchLabel(code)` mit deutschen Texten („leicht bewölkt", „Schnee-Regen-Schauer", „Gewitter", …) für a11y/Title.

## 3. Dispatcher umstellen

- `WeatherIcon` in `src/components/weather-icons/index.tsx`:
  - Wenn `mchCode` gesetzt und in `[1..35] ∪ [101..135]`: **direkt `<MchPictogram code={mchCode} … />` zurückgeben**.
  - `pickMchIcon` und der ganze Heuristik-Block entfallen.
  - WMO-Pfad bleibt unverändert als Fallback für Quellen ohne MCH-Code (Open-Meteo).
- Day/Night-Flip ist nicht mehr nötig: der MCH-Code trägt die Nacht-Variante (≥ 100) schon selbst.

## 4. Server-SVG-Pfad

- `src/lib/weather-icon-svg.server.ts`: bei vorhandenem MCH-Code das passende SVG **inline einbetten** (Datei beim Build per `fs.readFileSync` in eine Map ziehen), damit noscript-/Snapshot-Embeds dieselbe Symbolik liefern.
- `pickMchSvg`/Heuristik-Mapping entfällt.

## 5. Geltungsbereich

- Stündliche Icons in `weather-widget.tsx` und `region-map.tsx` (beides reicht `mchCode` bereits durch).
- Daily-Icons: dort umstellen, wo `daily.weathercode_mch` durchgereicht wird; sonst kleiner Folge-PR, der das Feld analog zur Hourly-Pipeline weitergibt.
- Keine Änderung an `scripts/ingest_mch_local_forecast.py`.

# Erwartetes Ergebnis

- Jeder MCH-Code rendert sein eigenes, dediziertes Pictogramm — 1:1, ohne Reduktion.
- Tag/Nacht direkt aus dem Code (≥ 100 = Nacht).
- Generisches Icon-Set (`IconRain`, `IconThunderstorm`, …) bleibt für Open-Meteo/WMO-Fallback bestehen.

# Offene Punkte

- **Bestätigung des Vorgehens „eigene SVGs nachbauen":** MeteoSwiss-Original-PNGs darf ich nicht ungefragt einbinden. Wenn du explizit die Original-Bilddateien willst, brauchst du eine Quelle/Lizenz dafür — dann lade ich sie als Assets hoch statt eigene SVGs zu bauen.
