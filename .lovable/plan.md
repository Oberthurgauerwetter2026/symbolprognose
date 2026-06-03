## Ziel
In `src/components/maps/precip-accum-map.tsx` die Ortsliste OSM-ähnlich ausbauen: Default zeigt nur die 4 Hauptorte, beim Reinzoomen erscheinen schrittweise weitere Gemeinden (Mittel-, dann Kleinstufen). Quadrat-Stil bleibt wie aktuell.

## Tiered Sichtbarkeit

**Stufe 0 (immer, Default-Zoom 9.5)**
- Bischofszell, Amriswil, Horn, Münsterlingen

**Stufe 1 (ab Zoom 11)** — grössere Orte / Bezirkshauptorte
- Romanshorn, Erlen, Güttingen, Egnach, Arbon, Kreuzlingen, Weinfelden, Sulgen

**Stufe 2 (ab Zoom 12)** — kleinere Gemeinden im Kartenausschnitt
- Hauptwil-Gottshaus, Langrickenbach, Berg, Hefenhofen, Salmsach, Uttwil, Kesswil, Dozwil, Roggwil, Sommeri, Hauptwil, Bürglen, Hohentannen, Zihlschlacht, Altnau, Lengwil, Bottighofen, Tägerwilen

(Genaue Auswahl: bestehende Liste in `src/data/spots.ts` + relevante TG-Gemeinden im Kartenausschnitt `[47.25–47.90, 8.65–9.95]`.)

## Implementierung
1. `CITIES`-Konstante in `precip-accum-map.tsx` erweitern; jedes Objekt erhält `minZoom`-Feld (0/11/12).
2. Bestehende `CityMarkers`-Komponente filtert bereits via `z >= (c.minZoom ?? 0)` — kein Logikänderung nötig.
3. Quadrat-Stil (`cityIcon`, 7×7 px blau gefüllt) unverändert.
4. Keine Änderungen an Heatmap/Legende/Download/Map-Konfiguration.

## Offene Frage falls relevant
Falls beim Reinzoomen Label-Überlappungen entstehen, könnten wir später eine einfache Kollisionsvermeidung ergänzen — vorerst nicht im Scope.
