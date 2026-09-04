# Warn-Tool: Reihenfolge ändern

## Verhalten neu

Das Formular in `/admin-warnungen` wird neu in dieser Reihenfolge angezeigt:

1. Gültigkeit (Beginn, Dauer, von/bis)
2. Betroffene Gemeinden
3. Gefahrenart
4. Warnstufe
5. Schwellen
6. Titel
7. Beschreibung (inkl. Mögliche Auswirkungen)
8. Optionale Eingabe (Böenspitzen / Menge, von–bis)

Alle Funktionen bleiben unverändert:
- Stufenempfehlung "Stufe X übernehmen"
- Automatische Textvorlagen bei Änderung von Gefahr/Stufe/Werten
- Zeitbaustein im Text bei Änderung der Gültigkeit
- Schwellenzeile richtet sich weiterhin nach der aktuell eingestellten Gültigkeitsdauer

## Technische Details

- Reine Umsortierung der JSX-Blöcke in `src/routes/admin-warnungen.tsx`; keine Änderung an State, Handlern, `THRESHOLDS` oder Speicherlogik.
- Die Gültigkeits-Box (aktuell Zeilen 747–810) wird an den Anfang des Formulars verschoben.
- Die Gemeindenauswahl (aktuell Zeilen 701–745) folgt direkt darauf.
- Danach kommen in bestehender Reihenfolge: Gefahrenart, Warnstufe, Schwellen, Textfelder, optionale Werteingabe.
