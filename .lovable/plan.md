## 1. Warntexte im Info-Panel lesbarer

In `src/components/maps/warn-map.tsx` (Panel rechts, gleiche Darstellung im Embed):
- Titelzeile der Warnung von 12 px auf ~14 px, Zeitraum von 11 px auf 13 px.
- Beschreibung, „Mögliche Auswirkungen“ und Gemeindeliste auf ~14 px, Fliesstext in Vordergrundfarbe statt gedämpft (Labels bleiben gedämpft).
- Klare Absätze: jede Textpassage (Zeitraum / Beschreibung / Auswirkungen+Verhalten / Gültigkeitsgebiet) mit deutlichem vertikalem Abstand und `leading-relaxed`, Karten-Padding etwas grösser.
- „Empfohlenes Verhalten“ wird als eigener, fett eingeleiteter Absatz dargestellt statt angehängt.

## 2. Karte: Schrift und Zentrierung der Ortsnamen

In `warn-map.tsx`:
- Label-Schrift von 11 px auf 13 px (gewarnte Gemeinden 14 px/bold), stärkerer weisser Halo für Lesbarkeit auf dem Relief.
- Zentrierung verbessern: statt reinem Flächenschwerpunkt (der bei konkaven/länglichen Gemeinden neben oder ausserhalb der Fläche landet) wird der Punkt maximaler Distanz zum Rand innerhalb des grössten Rings bestimmt (Raster-Suche über die Bounding-Box, Point-in-Polygon-Test, Verfeinerung in zwei Durchgängen). Damit sitzt jeder Name sichtbar mittig in seiner Region.

## 3. Benachrichtigungen: kompakt und einklappbar

In `src/components/warnings/push-opt-in.tsx`:
- Standardzustand: nur eine Zeile „Gemeinden wählen (0 von 12)“ mit Chevron. Die Gemeindeliste, die Alle/Keine-Schalter und der Hinweistext erscheinen erst nach dem Aufklappen.
- Im aufgeklappten Zustand kompakter: kleinere Chips (Padding reduziert, ~13 px), engere Abstände, maximale Listenhöhe kleiner.
- Der Aktivieren-Button bleibt immer sichtbar und weiterhin deaktiviert, solange 0 Gemeinden gewählt sind; die gewählte Anzahl steht in der Kopfzeile.
- „Wie funktioniert das?“ bleibt als zweiter Ausklapper, ebenfalls kompakter.

## 4. Region-Auswahl zurücksetzen

Aktuell bleibt eine angeklickte Gemeinde (dicker Umriss) auch dann markiert, wenn danach ein anderer Gefahren-Filter gewählt wird. Künftig:
- Klick auf „Alle“ oder eine Gefahrenart hebt die Gemeindeauswahl auf (`setSelected(null)`), das Info-Panel zeigt wieder die Regionsübersicht.
- Klick auf die Karte ausserhalb einer Gemeinde bzw. erneuter Klick auf dieselbe Gemeinde hebt die Auswahl weiterhin auf.

## Technische Hinweise

Betroffene Dateien: `src/components/maps/warn-map.tsx` (Labels, Panel-Typografie, Reset bei Filterwechsel) und `src/components/warnings/push-opt-in.tsx` (Collapse-Zustand, kompaktere Chips). Keine Backend- oder Datenbankänderung nötig.
