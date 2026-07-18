## Problem

Höher gelegene bzw. weiter entfernte Orte (Säntis, Alpenorte außerhalb Oberthurgau) laden in der Lokalprognose nicht mehr. Ursache liegt in `src/lib/forecast-aggregated.functions.ts`:

- Die Distanz-Gates `MCH_MAX_KM = 5` und `PHASEA_MAX_KM = 4` wurden bewusst eng gesetzt, damit Bergpunkte nicht auf Talstationen gemappt werden.
- Fallen beide Cache-Pfade durch, wird `fetchForecast(lat, lon)` direkt gegen `api.open-meteo.com` aufgerufen. Vom Cloudflare-Worker-Egress trifft das oft ein IP-Rate-Limit (429) — das war ja der ganze Grund, weshalb wir überhaupt einen R2-Cache haben.
- Beim Fehler liefert `emptyForecast()` eine syntaktisch valide, aber inhaltlich leere Response → im UI erscheinen fehlende/0-Werte statt einer sinnvollen Prognose.

Ergebnis: Für alle Orte, die weiter als 4–5 km vom nächsten Cachepunkt liegen (typischerweise Berge und Alpen-Punkte außerhalb des Oberthurgau-BBOX), gibt es faktisch keine Daten mehr.

## Ziel

Berg-/Fernorte laden wieder verlässlich, ohne dass die 2024 eingeführte Höhenkorrektur für Säntis & Co. wieder auf Talstationen zurückfällt.

## Änderungen (nur `src/lib/forecast-aggregated.functions.ts`)

1. **Direct-Open-Meteo mit Retry + Stale-Toleranz**
   - `fetchForecast` in eine kleine Retry-Schleife (2 Versuche, 400 ms Backoff) legen.
   - Bei Erfolg wie bisher in `directForecastCache` legen; der bestehende TTL-Cache wird bei Ausfall zusätzlich als **stale** zurückgegeben (Alter ignorieren) statt sofort `emptyForecast` zu liefern.

2. **Cache-Nearest-Fallback statt Empty**
   - Wenn der direkte Call scheitert **und** kein stale-Cache existiert: den **nächsten MCH- bzw. phaseA-Punkt ohne Distanz-Gate** verwenden.
   - Wird dieser Notfallpfad genutzt, wird das im Response-Header `x-forecast-fallback: nearest-cache` markiert (Debug) — im UI unverändert.

3. **Distanz-Gates leicht öffnen, ohne Höhenqualität zu verlieren**
   - `MCH_MAX_KM: 5 → 8`, `PHASEA_MAX_KM: 4 → 6`. Damit werden mehr Alpenvorlandsorte im ersten Anlauf sauber bedient; echte Berggipfel bleiben außerhalb und gehen weiterhin über den direkten (jetzt robusten) Open-Meteo-Pfad — der die DEM-Höhenkorrektur mitliefert.

4. **Warn-Logs vereinheitlichen**
   - Bei Nutzung des Nearest-Fallbacks eine klare `console.warn`-Zeile mit Distanz, damit spätere Ingest-Erweiterungen (z. B. dedizierte Berg-Punkte im BBOX) datengetrieben entschieden werden können.

## Nicht in diesem Plan

- Keine Änderungen am `WeatherWidget`, an `SPOTS`, `MapTabs` oder der UI.
- Kein Ausbau des Ingest-BBOX oder neuer Höhen-Layer — reine Server-Aggregator-Robustheit.
- Keine Lapse-Rate-Korrektur (könnte in einem Folge-Plan kommen, wenn nach dem Fix immer noch Temperaturausreißer auftreten).

## Technische Details

- Datei: `src/lib/forecast-aggregated.functions.ts`
- Neue interne Helper: `fetchForecastWithRetry(lat, lon)` und `pickAnyNearest(...)` (Cache-Nearest ohne Distanz-Gate) im selben Modul.
- Der bestehende `emptyForecast(...)`-Pfad bleibt als allerletzte Notbremse erhalten, wird aber nur noch erreicht, wenn weder MCH- noch phaseA-Cache irgendwelche Punkte enthält.
