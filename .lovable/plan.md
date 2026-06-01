Ja — Sonnenschein wird aktuell schon an die Icons übergeben und in der Tages-Aggregation berücksichtigt. Die Wolken-Klassifikation ist aber nur teilweise wirksam: Die Ensemble-Abfrage lädt `cloud_cover_low/mid/high` aktuell nicht mit, und `wrapEnsembleAsForecast`/MOSMIX-Overwrite übernehmen diese Felder ebenfalls nicht. Dadurch landen in den Kacheln häufig `0`/fehlende Wolkenwerte, weshalb die neue Klassifikation kaum sichtbar werden kann.

Plan:

1. `src/lib/weather.ts` korrigieren
   - `cloud_cover_low`, `cloud_cover_mid`, `cloud_cover_high` in die Ensemble-Hourly-Variablen aufnehmen.
   - Diese Felder in `wrapEnsembleAsForecast` übernehmen.
   - Beim MOSMIX-Overwrite die Cloud-Felder nicht versehentlich aus dem späteren Forecast verlieren.
   - Die Tagesklassifikation weiter aus den 06:00–21:00-Stunden berechnen, aber mit echten Wolkenwerten.

2. Stündliche Symbol-Klassifikation robuster machen
   - Für einzelne Stunden nicht nur den rohen `weathercode` anzeigen, sondern bei trockenem Wetter anhand von Wolkenstockwerken + Sonnenscheindauer sichtbar auf `klar/heiter/teils bewölkt/bewölkt` korrigieren.
   - Das betrifft direkt die Stundenprognose und die Karten-Pills.

3. Cache-Version erneut erhöhen
   - Forecast-Version von `v4` auf `v5` erhöhen in `WeatherWidget` und `RegionMap`, damit garantiert keine alten Browser-/Server-Antworten verwendet werden.

4. Validierung
   - In der Preview `/karten/lokal` prüfen, ob der neue Request geladen wird.
   - Sichtbar kontrollieren, dass Tageskacheln, Stundenprognose und Karten-Pills die neuen Cloud-/Sunshine-Felder nutzen.