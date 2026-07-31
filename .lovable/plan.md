# Vorinformations-Chip nicht mehr abschneiden

Im Warn-Infopanel ragt der Chip „Vorinformation“ über den rechten Rand der Kopfzeile hinaus, weil der Titel neben ihm nicht schrumpfen darf und der Chip in einer Zeile bleiben muss.

## Umsetzung

- Kopfzeile der Warnung so umbauen, dass Titel und Chip nebeneinander passen: Titel in einen eigenen, schrumpffähigen Bereich legen (`min-w-0`, Umbruch erlaubt), Chip bleibt rechts und wird nicht gequetscht.
- Auf schmalen Panelbreiten rutscht der Chip unter den Titel statt aus dem Rahmen zu laufen (Zeilenumbruch der Kopfzeile).
- Chip kompakter: kleinere Schrift/Padding und kein Umbruch im Wort, damit er auch in der rechten Spalte des Embeds vollständig sichtbar ist.
- Alternativ redundanzfrei: enthält der Titel schon „Vorinformation“, entfällt der Chip — der farbige, schraffierte Kopf bleibt als visuelles Merkmal.

## Technisch

- Datei: `src/components/maps/warn-map.tsx`, Kopfzeile der Warnliste (ca. Zeile 703–723).
- Container von `flex items-center` auf `flex flex-wrap items-center` mit `min-w-0` für den Titel-Span; Chip behält `shrink-0` und erhält `whitespace-nowrap`.
- Chip nur rendern, wenn `w.advisory` und der Titel nicht mit „Vorinformation“ beginnt.
- Keine Logik-, Daten- oder Schema-Änderungen.
