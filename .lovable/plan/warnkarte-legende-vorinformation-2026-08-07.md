# Warnkarte: Legende „Vorinformation"

## Ziel

In der Warnkarte soll die Legende für Vorinformationen nicht mehr „schraffiert = Vorinformation" lauten, sondern nur noch „Vorinformation".

## Geplante Änderungen

- In `src/components/maps/warn-map.tsx` an zwei Stellen die Legende-Bezeichnung ändern:
  1. Eingeklappte Karten-Legende (Overlay unten links): `schraffiert = Vorinformation` → `Vorinformation` (Zeile 619).
  2. Info-Panel-Ansicht ohne ausgewählte Region (Rechts-Panel): `schraffiert = Vorinformation` → `Vorinformation` (Zeile 704).
- Das Schraffur-Muster selbst bleibt als visueller Indikator erhalten, nur der Text wird gekürzt.

## Nicht im Scope

- Keine Änderungen an Schraffur-Stil, Farben, Kartenlogik, Server-Funktionen oder Datenbank.
