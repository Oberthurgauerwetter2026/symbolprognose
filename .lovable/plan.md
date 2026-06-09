# Aktuelle Temperatur + Regen aus Station Oberthurgau

Im statischen Embed `/api/public/embed/region-lokal-static` werden die beiden Felder **Temperatur** und **Regenrate** im «Aktuell»-Block nicht mehr aus Open-Meteo, sondern aus der Meteobridge-Station «Oberthurgau» (Weather-Hub-Projekt) gezogen. Symbol, Wind, Zeitreihe und 7-Tage bleiben unverändert aus Open-Meteo.

## Voraussetzung im Weather-Hub-Projekt (separat)

Die Werte liegen heute in der Tabelle `stations` / View `public_stations` und sind nur per Service-Role lesbar. Damit dieses Projekt sie ohne Secret holen kann, braucht es im **Weather-Hub-Projekt** eine neue öffentliche Lese-Route:

- Datei: `src/routes/api/public/stations.ts`
- Methode: `GET`
- Antwort: JSON-Array `[{ id, name, temperature, rain_rate, measured_at }, …]` aus `public_stations`
- Caching-Header: `cache-control: public, max-age=30, s-maxage=60, stale-while-revalidate=300`
- Optional: `?name=Oberthurgau` filtert serverseitig

(Diese Datei wird im Weather-Hub-Projekt angelegt — nicht in diesem Repo. Sobald sie unter `https://live-wetterkarte.lovable.app/api/public/stations?name=Oberthurgau` antwortet, ist die Lovable-Cloud-Seite fertig.)

## Änderungen in diesem Projekt

### 1. Neuer Server-Helper `src/lib/weather-hub.server.ts`
- Funktion `fetchOberthurgauStation()` lädt per `fetch` die o. g. URL.
- Liefert `{ temperature: number | null, rain_rate: number | null, measured_at: string | null } | null`.
- Validierung mit `Number.isFinite`; bei Fehler/Timeout (2 s) `null` zurück und `console.warn`, damit das Embed beim Stations-Ausfall trotzdem rendert (Fallback = Open-Meteo-Werte).
- Eigener kleiner In-Memory-Cache (~30 s) zusätzlich zu HTTP-Caching, damit die Worker-Aufrufe günstig bleiben.

### 2. `src/routes/api/public/embed/region-lokal-static.ts`
- Vor dem Render-Aufruf parallel zu `buildLokalNoscriptData` auch `fetchOberthurgauStation()` ausführen.
- Im erzeugten `data.current`:
  - `temperature` durch Stationswert ersetzen, falls vorhanden
  - `precipitation` durch `rain_rate` der Station ersetzen, falls vorhanden
  - `time` durch `measured_at` der Station ersetzen, falls vorhanden (damit der angezeigte Zeitstempel zu den Messwerten passt)
- Symbol (`weathercode`), Wind und Windrichtung bleiben unverändert aus Open-Meteo.
- `now-sub`-Zeile bleibt: `{rain_rate} mm/h · {wind} km/h {dir}` — Regenwert ist jetzt Stationsmesswert.

### 3. Keine UI-/Styling-Änderungen
- Header bleibt entfernt, Symbolgrössen bleiben (56 / 28 px), Layout unverändert.
- Kein zusätzliches «Quelle: Station»-Label, damit nichts ausserhalb der TWINT-Spalte gedrückt wird.

## Nicht betroffen
- Interaktive Routen `/embed/region-lokal` und `/embed/lokal`
- Snippet/Embed-Info-Seite
- Stunden- und 7-Tage-Tabellen
- Caching-Header der statischen Route (bleibt `max-age=60, s-maxage=300, stale-while-revalidate=3600`)

## Offene Fehlerpfade
- Station antwortet 404 / Timeout → Fallback Open-Meteo-Werte (kein UI-Hinweis).
- Station liefert `null`-Felder (Sensor offline) → einzelnes Feld fällt auf Open-Meteo zurück, anderes bleibt Station.
