# Vorinformation: Titel wirklich zweizeilig

## Problem

Im Info-Panel der Warnkarte steht bei Vorinformationen weiterhin alles auf einer Zeile. Grund: Der gespeicherte Warntitel beginnt selbst schon mit „Vorinformation …“ (z. B. „Vorinformation Gewitterwarnung (Stufe 1)“). Die aktuelle Logik zeigt das separate Label „Vorinformation“ nur dann, wenn der Titel *nicht* mit diesem Wort beginnt – also in genau diesem Fall nie. Übrig bleibt eine einzige, abgeschnittene Zeile.

## Lösung

Im Kopfbereich der Warnkarten-Liste (`src/components/maps/warn-map.tsx`):

1. Bei `advisory`-Warnungen das Label „Vorinformation“ **immer** in der ersten Zeile anzeigen.
2. Ein etwaiges „Vorinformation“-Präfix aus dem Titeltext entfernen, damit es nicht doppelt erscheint.
3. Den verbleibenden Warntitel (z. B. „Gewitterwarnung (Stufe 1)“) in der zweiten Zeile darstellen.

Gleiche Logik zusätzlich für die schmale Banner-Variante prüfen, damit die Darstellung konsistent ist.

## Technische Details

- Betroffene Datei: `src/components/maps/warn-map.tsx` (Header-Block der Warnungs-Liste, ca. Zeilen 719–730).
- Titel-Normalisierung: Präfix `Vorinformation` (case-insensitive, inkl. folgendem Leerzeichen/Doppelpunkt) abschneiden; bleibt danach nichts übrig, den generierten Standardtitel `"<Gefahr> (Stufe X)"` verwenden.
- `truncate` bleibt auf der Titelzeile, damit der Titel weiterhin eine Zeile belegt.
- Keine Änderungen an Datenmodell, Server-Funktionen oder Admin-Tool.
