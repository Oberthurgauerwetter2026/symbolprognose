## Warum nichts sichtbar war

Zwei voneinander unabhängige Ursachen:

1. **Tageskacheln**: Die Logik wurde zwar in `weather.ts` (Aggregator) und `weather-icons/index.tsx` (Daily-Scope) bereits angepasst, aber `getAggregatedForecast` setzt `Cache-Control: s-maxage=900, stale-while-revalidate=3600`. Die Cloudflare-Edge liefert daher bis zu eine Stunde lang die **alten** aggregierten Codes aus — die neue Server-Logik läuft, das Ergebnis wird aber nicht ausgespielt. Zusätzlich hält React Query die alte Antwort im Browser.

2. **Stündliche Prognose**: Die `WeatherIcon`-Logik nutzt Sonnenanteil und Wolken-Stockwerke aktuell **nur für `scope="daily"`**. Im Hourly-Scope wird der WMO-Code 1:1 vom Modell übernommen. Wenn Open-Meteo also für eine Stunde Code 51 (Drizzle) liefert, bleibt es Drizzle — auch wenn parallel die Sonne scheint und nur 0,1 mm fallen.

## Änderungen

### 1) `src/components/weather-icons/index.tsx` — Hourly-Logik analog zur Tageslogik

- **Sun-Shower für stündliche Schauer-/Drizzle-Codes**:
  Für Codes `51–57`, `61–65`, `80–82` im Hourly-Scope: wenn `sunshineRatio ≥ 0.3` *und* `precip < 1 mm`, dann `IconSunShower` statt `IconDrizzle/IconRain`. Echter Dauerregen (precip ≥ 1 mm oder code 66/67) bleibt unverändert.
- **Wolken-Stockwerke für Hourly bei trockenen Codes (≤3)**:
  Den bestehenden `hasLayers`-Block (Zeile 401–415) so umstellen, dass er für **beide** Scopes greift — nicht nur daily. Damit wird eine Stunde mit Code 2 + low-cloud 70 % auch stündlich als `IconCloudy` gezeichnet, und Code 0 + nennenswerter mid/high cloud wird zu `IconMostlyClear` / `IconPartlyCloudy` aufgewertet.
- **Sonnen-Korrektiv für Hourly bei Code 2/3**:
  Den Block bei Zeile 420 (`if (isDay && code===2|3 && sunshineRatio...)`) für Hourly aktiv lassen — bereits scope-unabhängig, nur Schwellen für 1-h-Werte leicht anziehen (`0.65` für MostlyClear, `0.35` für PartlyCloudy), da pro Stunde der Sonnenanteil 0 oder 1 sein kann.

### 2) `src/lib/forecast-aggregated.functions.ts` — Cache busten

- `Cache-Control` auf `public, max-age=60, s-maxage=120, stale-while-revalidate=300` reduzieren, damit Änderungen an der Icon-/Aggregator-Logik nach Deploy innerhalb von ~2 Min sichtbar sind statt nach bis zu 1 h.
- Optional in den Query-Key in `weather-widget.tsx` einen Versions-String aufnehmen (`["forecast", "v2", lat, lon]`), damit auch der Browser-Cache von React Query nach Logikänderungen einmalig verworfen wird.

### Erwartetes Verhalten

- Tageskacheln zeigen die bereits implementierte Logik (Sonne+Schauer → `IconSunShower`, „klar" mit Wolken → `MostlyClear`/`PartlyCloudy`) jetzt **auch tatsächlich im Browser**, sobald die kürzere Cache-Frist abläuft.
- Stündliche Kacheln: eine 14-Uhr-Zelle mit Code 51, 0,3 mm Niederschlag und 45 Min Sonne → `IconSunShower` statt `IconDrizzle`. Code 2 + 70 % low-cloud → `IconCloudy` statt nur „teils bewölkt".
- Reine Regenstunden (≥ 1 mm oder code 66/67/82) bleiben Regen.

Nicht angefasst: Datenholen/Open-Meteo-Parameter, Wind-/Temperatur-Logik, alle übrigen Routen.
