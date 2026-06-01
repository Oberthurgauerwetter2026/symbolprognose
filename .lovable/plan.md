## Plan

1. **Cache komplett versionieren**
   - Den Server-Funktions-Request bekommt einen expliziten `version`/`cacheBust`-Parameter, damit bestehende Edge-Cache-Einträge nicht mehr getroffen werden.
   - Der React-Query-Key wird auf eine neue Version gesetzt und die Forecast-Query wird beim Laden/refokussieren aktiv erneuert.

2. **Server-Antwort kurzfristig nicht mehr stale ausliefern**
   - Für die Wetter-Serverfunktion setze ich vorübergehend strengere Header wie `no-cache`/sehr kurze Revalidierung, damit Änderungen an Symbol-/Aggregationslogik sofort sichtbar werden.
   - Die eigentliche Wetterdaten-Quelle bleibt unverändert; es geht nur darum, alte zwischengespeicherte Antworten zu vermeiden.

3. **Sicherstellen, dass die angezeigten Kacheln wirklich neue Daten nutzen**
   - Tageskacheln und Stundenprognose verwenden weiterhin dieselbe Datenquelle, aber mit frischem Query-Key.
   - Ich prüfe zusätzlich, ob `/karten/lokal` oder Embed-Routen noch einen anderen Key/Fallback nutzen.

4. **Validierung**
   - Nach der Umsetzung prüfe ich anhand der geladenen Network-Antwort/Preview, dass der neue Request nicht mehr die alte gecachte Antwort verwendet und die Kacheln/Stundenprognose neu berechnet werden.