# Warnungs-Titel und Vorinformation auf zwei Zeilen

## Ziel

Im Info-Panel der Warnkarte sollen Titel („Gewitterwarnung (Stufe 1)“) und der Chip „Vorinformation“ nicht mehr in einer Zeile nebeneinander stehen, sondern untereinander angezeigt werden, damit der Titel vollständig lesbar ist und das Label klar zugeordnet ist.

## Beobachtung

Im aktuellen `warn-map.tsx` sitzt der Titel in einem `truncate`-Span mit `flex-1` innerhalb einer `flex flex-wrap`-Zeile, das „Vorinformation“-Label ist ein Inline-Chip daneben. Das führt bei längeren Titeln zu Kürzung und ungünstiger Lesbarkeit.

## Geplante Änderung

- Datei: `src/components/maps/warn-map.tsx`, Zeile 706–729.
- Neues Layout:
  - Titel und Icon bleiben in der obersten Zeile.
  - Der „Vorinformation“-Chip rutscht in eine eigene Zeile unter den Titel.
- Implementierung:
  - Header-Container: `items-start` statt `items-center` behalten, aber innere Struktur mit vertikalem Block.
  - Titel-Span: `block truncate` statt `inline truncate`.
  - Vorinformation-Span: eigene Zeile mit `block w-fit` oder `inline-block`.
- Beispiel-Reihenfolge: Titel oben, Vorinformation unten.

## Nicht im Scope

- Keine Änderung an Inhalt, Farbgebung oder Logik der Warnung.
- Keine Datenbank-/Server-Änderungen.
