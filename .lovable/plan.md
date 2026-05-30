## Ziel
Die Niederschlags-Prognose soll sichtbar über den angeforderten Radius reichen: Schaffhausen, Zürich, Süddeutschland, St. Gallen, Appenzell und Vorarlberg — nicht nur als kleiner Block um den Oberthurgau.

## Befund
- Die gewünschte BBOX ist im Ingest und Server bereits eingetragen.
- Der Screenshot zeigt aber weiterhin ein kleines Rechteck, was sehr wahrscheinlich daran liegt, dass die App noch das alte R2/Open-Meteo-Cache-Grid verwendet.
- Zusätzlich fällt die interne Advektions-/Smoothing-Logik noch auf die statische BBOX-Konstante zurück; wenn Cache-Grid und Konstante auseinanderlaufen, kann das die Darstellung weiter inkonsistent machen.
- Der separate `openmeteo-symbol.yml` Workflow kann beim Aktualisieren von `forecast.json` wieder ein altes, kleines Grid in denselben Cache schreiben.

## Umsetzung
1. **Cache-Grid erzwingen**
   - In `src/lib/radar.functions.ts` nicht mehr blind das Grid aus altem Cache übernehmen, wenn es die angeforderte Abdeckung nicht erfüllt.
   - Cache-Grid nur akzeptieren, wenn es mindestens die Ziel-BBOX abdeckt und die erwartete Punktzahl/Geometrie plausibel ist.
   - Bei altem Cache klare Warnung zurückgeben, statt das alte kleine Grid weiter als Wahrheit zu verwenden.

2. **Advektionslogik an aktives Grid koppeln**
   - `dLat`, `dLon` und `midLat` aus `lats/lons` des aktiven Grids berechnen, nicht aus der statischen BBOX.
   - Dadurch bleibt Smoothing korrekt, egal ob Grid aus Cache oder Fallback kommt.

3. **Workflow-Konflikt beheben**
   - `.github/workflows/openmeteo-symbol.yml` so anpassen, dass er nicht mehr mit der alten kleinen BBOX in `openmeteo/forecast.json` schreibt.
   - Entweder dieselbe erweiterte BBOX/Grid-Geometrie verwenden oder einen separaten Output-Key für Symbolprognose nutzen, damit Radar-Cache nicht überschrieben wird.

4. **Frontend-Absicherung**
   - In `radar-map.tsx` die Karten-Bounds/Startansicht mit der erwarteten erweiterten Region konsistent halten.
   - Optional: keine Änderung an Farben/Legende/Timeline; nur die Abdeckung.

5. **Validierung**
   - Prüfen, dass die gelieferten `gridLat/gridLon` den Zielbereich tatsächlich abdecken.
   - Sicherstellen, dass Prognose-Frames `values.length === gridLat.length * gridLon.length` haben.
   - Danach sollte die farbige Prognose nicht mehr als kleiner Block erscheinen, sondern über die gesamte angeforderte Region rendern.