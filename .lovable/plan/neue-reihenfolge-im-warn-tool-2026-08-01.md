# Neue Reihenfolge im Warn-Tool

Formular in `/admin-warnungen` wird umsortiert auf:

1. Gefahrenart
2. Warnstufe
3. Schwellen (Überschrift ohne "MeteoSchweiz", nur "Schwellen" + Stundenangabe)
4. Titel
5. Beschreibung (inkl. Mögliche Auswirkungen)
6. Optionale Eingabe (Böenspitzen / Menge, von–bis)
7. Betroffene Gemeinden
8. Gültigkeit (Beginn, Dauer, von/bis)

## Umsetzung

- Der Schwellen-Block wird aus der Messwert-Box herausgelöst und als eigener Kasten direkt unter der Warnstufe platziert; Titel lautet nur noch `Schwellen · X Std.`.
- Die optionale Werteingabe (von/bis) bleibt als eigener Kasten, wandert aber unter die Textfelder.
- Der Gültigkeits-Kasten wandert ans Ende, nach den Gemeinden.
- Alle Funktionen bleiben unverändert: Stufenempfehlung "Stufe X übernehmen", automatische Textvorlagen bei Änderung von Gefahr/Stufe/Werten, Zeitbaustein im Text bei Änderung der Gültigkeit.

## Technische Details

- Reine Umsortierung der JSX-Blöcke in `src/routes/admin-warnungen.tsx`; keine Änderung an State, Handlern, `THRESHOLDS` oder Speicherlogik.
- Die Schwellenzeile richtet sich weiterhin nach der aktuell eingestellten Gültigkeitsdauer (Standardwert beim Start), auch wenn die Gültigkeit jetzt weiter unten steht.
