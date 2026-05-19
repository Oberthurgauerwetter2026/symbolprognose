## Befund

Das Problem ist nicht mehr der Wetterdaten-Request selbst: Der Open-Meteo-Request liefert im Browser `200 OK`. Die Seite bricht danach beim Rendern ab und landet deshalb im globalen Fehlerbildschirm „This page didn't load“.

Die wahrscheinliche Ursache ist die API-Antwort: Bei `meteoswiss_icon_seamless` kommen für mehrere Wind-Felder `null` zurück, während die UI diese Werte direkt rundet/formatiert und für CSS-Transforms verwendet. Das kann den React-Render der Root-Route abbrechen.

Zusätzlich zeigen die Dev-Server-Logs noch alte CSS-Import-Fehler. Ich werde nach der Codekorrektur den Dev-Server neu starten, damit keine veraltete Vite-Transformation mehr im Preview hängt.

## Plan

1. **Wetterdaten normalisieren**
   - In `src/lib/weather.ts` die API-Antwort nach dem Fetch bereinigen.
   - Fehlende/null-Werte für Wind, Böen, Windrichtung, Temperatur, Niederschlag, Schnee und Wettercode auf sichere Fallbacks setzen.
   - Dadurch muss die UI nicht mehr mit `null` rechnen.

2. **UI gegen unvollständige Wetterdaten absichern**
   - In `src/components/weather-widget.tsx` direkte Formatierungen wie `.toFixed(...)`, `Math.round(...)`, `weatherLabel(...)`, `WeatherIcon code=...` und `WindArrow deg=...` mit sicheren Hilfsfunktionen bzw. Fallbacks absichern.
   - Tages- und Stundenansichten sollen auch bei teilweise fehlenden Modelldaten weiter rendern.

3. **Router-Fehlerausgabe robuster machen**
   - In `src/router.tsx` einen `defaultErrorComponent` ergänzen, damit künftige Fehler sauber abgefangen werden.
   - Root-Error bleibt bestehen, aber die App bekommt eine zusätzliche Sicherheitslinie.

4. **Preview neu laden/validieren**
   - Dev-Server neu starten, damit die alten CSS-Fehler aus dem Vite-Cache verschwinden.
   - Danach prüfen, ob die Startseite statt des globalen Fehlerbildschirms wieder das Wetter-Widget anzeigt.