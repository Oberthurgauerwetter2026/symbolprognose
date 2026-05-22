## Ziel

Herausfinden, warum MOSMIX-Werte ab Tag 6 in der UI nicht durchschlagen. Reine Diagnose — kein UI-, kein Logik-Refactor. Nach Auswertung der Logs folgt ein zweiter, gezielter Fix.

## Änderungen (nur Logging)

### 1. `src/lib/mosmix.functions.ts` — `fetchMosmix` Handler
Am Anfang und Ende des Handlers strukturiert loggen:
- `[MOSMIX] start lat=… lon=… → station=06621/06678 distanceKm=…`
- HTTP-Status der KMZ-Antwort
- Anzahl geparster Zeitschritte, Anzahl finiter TTT-Werte
- `[MOSMIX] done id=… steps=… firstTime=… lastTime=…`
- Im Catch: `[MOSMIX] FAIL …` (statt nur `console.error`)

### 2. `src/lib/weather.ts` — `fetchForecast`
Vor dem MOSMIX-Merge protokollieren:
- `[FORECAST] offsetSec=…  primarySource=…  hourlyLen=…`
- Wenn `mosmixRaw` `null`: `[FORECAST] mosmix=null` (mit Grund-Hinweis: Distanz vs. HTTP vs. Catch)
- Wenn `mosmixRaw` vorhanden: erste/letzte MOSMIX-Zeit + erste/letzte lokale Timeline-Zeit
- In `alignMosmixToTimeline`: Rückgabe-Statistik `matched / (n - minLocalHourIndex)` zurück an Caller, Caller loggt z. B. `[FORECAST] mosmix matched=37/48`
- Nach `overwriteFromIndex`: Sample-Werte für Tag 6, 12:00 lokal (Index ≈ 5*24+12) für Temperatur vor/nach Overwrite

### 3. Wie du es testest
- Region-Karte einmal frisch laden (Hard-Reload, da `useQuery`-Cache).
- Ich lese danach die Server-Logs (`server-function-logs`, alle Deployments) mit `search="MOSMIX"` bzw. `"FORECAST"` aus.
- Aus den Zahlen leite ich die exakte Ursache ab:
  - `mosmix=null` mit Distanz > 80 → Whitelist-Bug
  - HTTP 404/403 → DWD-URL/Stations-ID
  - `matched=0` → Offset-/Zeitachsen-Bug (Verdacht: `offsetSec=0`, weil Ensemble-API kein `utc_offset_seconds` liefert)
  - `matched > 0` aber Werte unverändert → Bug in `overwriteFromIndex` oder MOSMIX-Felder alle `NaN`

## Nicht enthalten
- Kein UI-Indikator/Badge.
- Keine Änderung an Stations-Whitelist oder Merge-Reihenfolge — das passiert erst im Fix-Schritt nach Diagnose.
- Logs werden nach dem Fix wieder reduziert.