# Grössere und mittelgrosse Orte im Standardfokus anzeigen

## Ziel

In Radar, Wind und Niederschlagssummen sollen im Standardfokus (initiale Zoom-Stufe) zusätzliche **grosse und mittelgrosse Referenzstädte** rund um den Oberthurgau erscheinen – ohne die bestehenden Orts-Labels im Kerngebiet zu verdrängen.

## Was gebaut wird

1. **Neue Datenquelle `src/data/reference-cities.ts`**
   - Liste von Referenzstädten im grösseren Radius (Ostschweiz / Bodensee / angrenzendes Vorarlberg / nördliches Zürcher Unterland).
   - Pro Stadt: `name`, `lat`, `lon`, `tier` (`"large"` | `"medium"`), `minZoom`.
   - Beispiele:
     - `large` (ab Zoom 8): Zürich, St. Gallen, Winterthur, Konstanz, Bregenz, Schaffhausen, Friedrichshafen.
     - `medium` (ab Zoom 9): Frauenfeld, Wil, Kreuzlingen, Dornbirn, Ravensburg, Feldkirch, Rapperswil-Jona, Uzwil, Gossau, Herisau, Appenzell, Trogen, Heiden.
   - Sicherstellen, dass keine Doppelungen zu `OBERTHURGAU_PLACES` entstehen (z. B. Romanshorn, Arbon, Amriswil bleiben in `OBERTHURGAU_PLACES` und werden nicht wiederholt).

2. **Wiederverwendbare Komponente `src/components/maps/city-markers.tsx`**
   - Kapselt `cityIcon` und `CityMarkers`.
   - Kombiniert `OBERTHURGAU_PLACES` und `REFERENCE_CITIES` zu einem eindeutigen Set (nach Name dedupliziert).
   - Zoom-Filter:
     - `large` Referenzstädte: ab Zoom 8
     - `medium` Referenzstädte: ab Zoom 9
     - `OBERTHURGAU_PLACES`: gemäss ihrem eigenen `minZoom` (10.5 / 11.5 / 12 / …)
   - Visuelle Unterscheidung:
     - Referenzstädte `large`: fetterer Punkt (•) und grössere/kräftigere Schrift.
     - Referenzstädte `medium`: leicht grösserer Punkt als die Orts-Labels im Oberthurgau.
     - Oberthurgau-Orte: unveränderte Optik.
   - `pointer-events: none`, `interactive={false}` – wie bisher.

3. **Integration in die drei Karten**
   - `src/components/maps/radar-map.tsx`: `RADAR_CITIES` + `cityIcon` ersetzen durch `<CityMarkers />`.
   - `src/components/maps/wind-map.tsx`: `WIND_CITIES` + `cityIcon` ersetzen durch `<CityMarkers />`.
   - `src/components/maps/precip-accum-map.tsx`: bestehende `CityMarkers`/`CITIES` ersetzen durch die zentrale Komponente.
   - In Wind und Radar wird aktuell **nicht** nach Zoom gefiltert; durch die neue Komponente erhält beides einen sauberen Zoom-Gate.

4. **CSS-Anpassung in `src/styles.css` (optional)**
   - Sicherstellen, dass `.radar-city-marker`, `.wind-city-marker`, `.accum-city-marker` nicht mehr hart benötigt werden; neue Klassen `city-marker` bzw. `city-marker-large`/`city-marker-medium` für konsistente Darstellung.

## Prüfung

- Desktop: Radar, Wind, Niederschlagssummen im Standardfokus – grosse Städte sichtbar, keine Überlappung/Doppelungen.
- Mobile: gleiche Karten, Labels nicht zu voll/dicht.
- Heranzoomen: mittelgrosse Städte erscheinen bei Zoom 9, bestehende Oberthurgau-Orte wie bisher.
- Keine neuen Build-Fehler; keine Regressions in den bestehenden Karten.
