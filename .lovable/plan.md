## Problem

Im Beispiel (Morgen / Amriswil) zeigt die Stundenprognose vormittags Sonne mit Wolken (08–15 Uhr), erst ab 18 Uhr Regen. Die Tageskachel zeigt trotzdem ein reines Regen-Icon (Dauerregen, 13.9 mm). Die aktuelle Logik in `aggregateDailyFromHourly` (`src/lib/weather.ts`, Z. 589–628) kippt sofort in die Regenkategorie, sobald `precipSum ≥ 5 mm` ODER `precipHours ≥ 6` — Sonnenstunden im Tagesverlauf werden dabei ignoriert.

## Ziel

Tage mit einer relevanten Sonnen-/Trockenphase **und** zusätzlichem Niederschlag werden als **Schauertag** klassifiziert (WMO 80/81/82, ggf. 95 bei Gewitter), nicht als Dauerregen (61/63/65). Nur wenn der Niederschlag den Tag wirklich dominiert (kaum Sonne, breit gestreut), bleibt es bei Dauerregen.

## Änderung (nur `src/lib/weather.ts`, Funktion `aggregateDailyFromHourly`)

Neue Klassifikation für den Tages-`weathercode`:

1. Kennzahlen über das Tagesfenster 06–21 Uhr berechnen (bereits vorhanden):
   - `precipHours` (Stunden mit ≥ 0.1 mm)
   - `precipSum` (mm)
   - `sunshineRatio` (vorhanden)
   - `dryHours = idxs.length - precipHours`
   - `maxHourlyPrecip = max(precipFinite)` (neu)
   - `thunderHours` = Anzahl Stunden mit stündlichem `weathercode ∈ {95,96,99}` (neu)

2. Drei Kategorien statt zwei:

   - **Trocken / sonnig–wolkig** (heutige Logik bleibt):
     `precipHours ≤ 1 && precipSum < 1` → bestehender Trocken-Zweig mit `adjustForClouds`.

   - **Schauertag (neu, deckt den Beispieltag ab)**:
     Bedingung erfüllt, wenn Regen vorkommt, der Tag aber nicht durchgehend nass ist:
     `precipHours ≥ 1 && (dryHours ≥ 4 || sunshineRatio ≥ 0.20) && precipHours < 8`.
     - Default: `80` (leichte Schauer)
     - `maxHourlyPrecip ≥ 2.5 mm` oder `precipSum ≥ 10 mm` → `81` (mäßige Schauer)
     - `maxHourlyPrecip ≥ 7.5 mm` → `82` (starke Schauer)
     - `thunderHours ≥ 1` → `95` (Gewitter hat Vorrang)

   - **Dauerregen (verschärft)**:
     Nur wenn `precipHours ≥ 8` ODER (`precipHours ≥ 6 && sunshineRatio < 0.15`).
     Code wie heute via `representativeWeathercode(..., { preferShower: false })`, aber `preferShower: false` setzen, damit nicht versehentlich 80 gewählt wird.

3. `adjustForClouds` weiter anwenden, aber nur auf Trocken-Zweig (Codes ≤ 3). Schauer-/Regencodes nicht umschreiben.

4. `representativeWeathercode` wird im Schauerzweig nicht mehr aufgerufen — der Code wird deterministisch aus Niederschlagsmenge/-spitze gewählt. Das verhindert das Kippen auf 61/63 durch einzelne Modellstunden.

## Konsequenz fürs UI

Keine Komponenten-Änderungen nötig. `weather-widget.tsx` und `region-map.tsx` lesen weiterhin `daily.weathercode[i]`. `WeatherIcon` rendert 80/81/82 bereits als Sonne+Schauer-Symbol, was dem gewünschten Mischbild entspricht.

## Cache

`FORECAST_VERSION` in `src/lib/forecast-aggregated.functions.ts` von `v6` auf `v7` bumpen, damit Vorschau und Browser die neuen Tagescodes laden.

## Verifikation

- Amriswil / „Morgen": Stundenwerte 08–15 Uhr trocken + sonnig, 18/21/00 Uhr Regen (Summe 13.9 mm, ~5 nasse Stunden, `maxHourlyPrecip` 4.6 mm). Erwartung nach Fix: Code **81** (mäßige Schauer) → Sonne+Schauer-Icon statt Dauerregen-Icon.
- Gegenprobe: Tag mit 10 nassen Stunden, `sunshineRatio < 0.1` → bleibt Dauerregen (z. B. 63).
- Trockener, sonniger Tag → unverändert (1/2/3 je Bewölkung).
