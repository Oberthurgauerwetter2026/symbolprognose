# Stationsabfrage auf "Amriswil" umstellen

Die Weather-Hub-Station heisst offenbar `Amriswil` (nicht `Oberthurgau`). Daher liefert der Endpoint `?name=Oberthurgau` ein leeres Array.

## Änderung

**Datei:** `src/lib/weather-hub.server.ts`

- Konstante `STATION_URL` von `?name=Oberthurgau` → `?name=Amriswil`.
- Funktion `fetchOberthurgauStation` → `fetchAmriswilStation` umbenennen.
- Match-Bedingung `row.name === "Oberthurgau"` → `=== "Amriswil"`.
- Log-Präfixe entsprechend anpassen.

**Datei:** `src/routes/api/public/embed/region-lokal-static.ts`

- Import und Aufruf auf `fetchAmriswilStation` umstellen.

Keine weiteren Dateien betroffen. Cache-/Timeout-Logik bleibt unverändert.

## Test

Nach Deploy: `https://symbolprognose.lovable.app/api/public/embed/region-lokal-static` zeigt Temperatur/Niederschlag aus der Station Amriswil; Zeitstempel = `measured_at` der Station.
