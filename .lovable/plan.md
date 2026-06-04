# Fix: Embed Lokalprognose – Laufzeitfehler `temperature_2m[c].toFixed`

## Diagnose

- Der iframe ruft `symbolprognose.lovable.app/embed/region-lokal`. Dort lädt `WeatherWidget` über `getAggregatedForecast` (POST `/_serverFn/…`).
- Live-Test auf der publizierten Domain: **HTTP 500** für genau diesen Server-Fn-Endpoint (Worker-Log `dwl.proxy.response.error`). Der Preview/Dev liefert dagegen 200.
- Ursache des Crashs im Browser: das Widget greift in `src/components/weather-widget.tsx:894` ungeschützt auf `h.temperature_2m[idx].toFixed(1)` zu. Wenn die Stunden-Schleife über `h.time.length` läuft, aber ein einzelnes Array (z. B. nach Teil-Cache oder Fallback-Ergebnis) kürzer/leer ist, gibt `[idx]` `undefined` → Crash. Dieselbe Schwachstelle gilt für `winddirection_10m[idx]`, `weathercode[idx]`, etc.
- Der R2-Cache liefert nur **suffigierte** Felder (`temperature_2m_meteoswiss_icon_ch2`, …). `pickArr` in `forecast-aggregated.functions.ts` deckt zwar alle aktuell beobachteten Suffixe ab, aber sobald ein einzelnes Modell ein Feld nicht liefert (oder ein zukünftiges Suffix dazukommt), bleibt das jeweilige Array leer, während `time` (168 Einträge) gefüllt bleibt → genau das oben gezeigte Crash-Muster.
- Warum publiziert 500: vermutlich greift im Worker die Fallback-Pfad-`fetchForecast()` (R2 nicht erreichbar oder Felder nicht gemappt → leere `phaseA`-Auswahl → 429 von Open-Meteo → `throw "Keine Wettermodelle erreichbar"`). Aktuell wird der Fehler ungefiltert zum 500 durchgereicht.

## Lösung – drei kleine, voneinander unabhängige Schritte

### 1. Server-Fn nie mehr 500: leere, valide Antwort + Logging

`src/lib/forecast-aggregated.functions.ts` – `handler`:

- `try/catch` um den `fetchForecast`-Fallback. Bei Fehler **nicht** werfen, sondern eine `sanitizeForecast(emptyForecast)`-Antwort zurückgeben (alle Arrays leer, `latitude/longitude/timezone` aus dem Input). So bekommt der Client immer ein valides Schema, die `useQuery` rendert kein Error-Boundary und der WordPress-Embed bleibt funktional (zeigt „keine Daten" statt weisse Seite).
- Cause-Logging (`console.error("[aggregated-forecast] hard fail", err)`), damit wir die Ursache in den Worker-Logs sehen.

### 2. Cache→Forecast-Mapping längen-konsistent

`src/lib/forecast-aggregated.functions.ts` – `buildForecastFromCacheLoc`:

- Nach dem Aufbau aller `hourly`-Arrays auf die Länge von `hourly.time` **padden** (Default `0` für Zahlen, `0` für weathercode). Analog `daily` auf `daily.time` padden. Damit ist garantiert: jeder `idx < time.length` liefert einen definierten Wert, egal ob der Cache ein einzelnes Modell-Feld nicht enthält oder ein neues Suffix auftaucht.
- Keine Änderung an der Suffix-Liste – das löst nur Symptome.

### 3. Render-Guards im Widget (defensive UI)

`src/components/weather-widget.tsx` Hourly-Kachel (Zeilen ~860–940):

- `const temp = h.temperature_2m?.[idx]; const wdir = h.winddirection_10m?.[idx]; const wcode = h.weathercode?.[idx] ?? 0;`
- Temperatur-Render: `{Number.isFinite(temp) ? temp.toFixed(1) + "°" : "–"}` (entspricht dem Stil der Daily-Min/Max-Kacheln in Zeile 566/569).
- Windrichtung/Code-Helfer mit Fallback `0` aufrufen, damit `WindArrow`/`WeatherIcon` nie `undefined` bekommen.
- Schleife `allHourly` zusätzlich limitieren auf `Math.min(h.time.length, h.temperature_2m.length)` als zweite Verteidigungslinie.

Kein Layout-, Farb- oder Styling-Change – rein defensive Guards.

## Verifikation

1. Dev-Preview: `/embed/region-lokal` lädt wie bisher mit vollen Werten.
2. Server-Fn-Aufruf gegen Published nach Re-Publish: HTTP 200, `hourly.temperature_2m.length === hourly.time.length`.
3. Erzwungener Bad-Path-Test (lokal R2_PUBLIC_URL leeren): Endpoint liefert 200 mit leeren Arrays, Widget zeigt „keine Daten", **kein Crash** im Browser.
4. Worker-Log nach Republish: bei einem etwaigen Fallback-Fehler erscheint `[aggregated-forecast] hard fail …` statt 500-HTML.

## Nicht enthalten

- Keine Änderung an `getMultiModelForecast`, `radar.functions.ts`, am Ingest-Workflow oder am R2-Schema.
- Keine UI-/Designänderungen, kein neuer Cache, keine neuen Secrets.
- Nach dem Merge **muss publiziert** werden, damit `symbolprognose.lovable.app` (und damit der WordPress-Embed) den Fix bekommt.
