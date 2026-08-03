# Anzahl der Referenzstädte halbieren

## Ziel
Die im Standardfokus zusätzlich eingeblendeten Referenzstädte sollen deutlich weniger werden, um die Karte auf Mobile und Desktop aufgeräumter zu halten.

## Aktueller Zustand
- `src/data/reference-cities.ts` enthält 7 `large`- und 36 `medium`-Städte (insgesamt 43).
- `large` werden ab Zoom 8, `medium` ab Zoom 9 angezeigt.
- Die 7 grossen Städte (Zürich, St. Gallen, Winterthur, Konstanz, Bregenz, Schaffhausen, Friedrichshafen) bleiben wichtig für die Orientierung.

## Geplante Änderung
1. **Alle 7 `large`-Städte beibehalten.**
2. **`medium`-Städte von 36 auf ca. 14 reduzieren**, damit die Gesamtzahl der Referenzstädte auf etwa 21 (≈ Hälfte) sinkt.
3. **Auswahl-Kriterium:** Geografische Nähe und Relevanz für den Oberthurgau:
   - Beibehalten: Frauenfeld, Wil, Kreuzlingen, Dornbirn, Ravensburg, Rapperswil-Jona, Uzwil, Gossau, Herisau, Appenzell, Trogen, Heiden, Wattwil, Flawil.
   - Entfernen: entferntere Orte wie Feldkirch, Pfullendorf, Leutkirch, Kempten, Pfäffikon, Wädenswil, Bülach, Dietikon, Regensdorf, Andelfingen, Neuhausen, Stein am Rhein, Singen, Radolfzell, Überlingen, Reichenau, Tuttlingen, Villingen-Schwenningen, Donaueschingen, Hinwil, Wetzikon, Rüti ZH, Eschenz, Lindau.
4. **Keine Änderung an `src/components/maps/city-markers.tsx` oder den Karten-Integrationen** – nur die Datenquelle wird ausgedünnt.

## Prüfung
- Radar, Wind, Niederschlagssummen im Standardfokus zeigen deutlich weniger Referenzstädte.
- Keine neuen Build-Fehler; keine Änderungen an der Marker-Logik.
