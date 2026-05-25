# Auto-Geolocation auf der Lokalprognose

## Ziel
Wenn die Seite `/karten/lokal` neu geladen wird und noch kein Ort gewählt ist, soll automatisch der aktuelle Standort des Nutzers erkannt und als Prognose-Ort gesetzt werden. Manuelle Suche und der Ortungs-Button bleiben unverändert verfügbar.

## Aktuelles Verhalten
In `src/components/weather-widget.tsx`:
- `location` wird initialisiert aus (in dieser Reihenfolge): `lockedLocation` → `initialLocation` (URL-Params `lat`/`lon`/`name`) → `localStorage["weather:location"]` → `null`.
- Bei `null` erscheint der Hinweis „Gemeinde suchen oder Ortung verwenden".
- Geolocation passiert nur, wenn der Nutzer explizit den Ortungs-Button im `Header` klickt.

## Änderung
Einen einmaligen Auto-Geolocation-Effekt im `WeatherWidget` ergänzen:

- Läuft nur im Browser, nicht wenn `detailOnly` oder `lockedLocation` gesetzt sind.
- Läuft erst, nachdem der LocalStorage-Hydrate-Effekt durch ist (kleiner Microtask / Flag), damit eine gespeicherte Wahl nicht überschrieben wird.
- Wenn dann immer noch `location === null` ist und `navigator.geolocation` verfügbar ist: `getCurrentPosition` aufrufen, `reverseGeocode` für den Namen, `setLocation(...)` setzen. `setSelectedDayIdx(0)`.
- Bei Fehler / Permission-Denied: still bleiben — der bestehende „Gemeinde suchen oder Ortung verwenden"-Block bleibt sichtbar, der Nutzer kann manuell wählen.
- Nur einmal pro Mount auslösen (Ref-Guard), damit kein erneuter Permission-Prompt nach einer manuellen Wahl entsteht.

Kein Verhalten in `region-map`, Embeds oder URL-gesteuerten Aufrufen (`?lat=…&lon=…`) ändern — dort liefert `initialLocation` bzw. `lockedLocation` schon einen Wert, der Effekt überspringt sich.

## Technische Details
Datei: `src/components/weather-widget.tsx`
- Neuen `useEffect` direkt nach dem bestehenden LocalStorage-Hydrate-Effekt einfügen.
- `useRef<boolean>(false)` als Guard `didAutoLocate`.
- Mini-Delay via `setTimeout(…, 0)` oder zweiter Effekt mit Abhängigkeit auf einen `hydrated`-State, der nach dem ersten LocalStorage-Lauf auf `true` springt — verhindert Race mit dem Storage-Read.
- Geolocation-Optionen: `{ timeout: 8000, maximumAge: 5 * 60_000 }`, damit der Aufruf nicht hängt.

Keine weiteren Dateien betroffen.
