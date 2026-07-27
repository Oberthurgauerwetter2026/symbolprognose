## Ausgangslage

In der Benachrichtigungs-Box (`src/components/warnings/push-opt-in.tsx`) sind alle Gemeinden per Default ausgewählt. Ausgewählt = dunkler Chip (schwarz), nicht ausgewählt = grauer Chip. Das ist heute nur an der Farbe erkennbar, ohne Beschriftung, Häkchen oder Zähler — genau der Punkt, den du bemängelst.

## So funktioniert die Benachrichtigung heute

1. Du wählst Gemeinden und klickst „Benachrichtigungen aktivieren“.
2. Der Browser fragt nach Erlaubnis; danach wird ein kleiner Hintergrunddienst (`public/push-sw.js`) registriert und ein Abo (Endpoint + Schlüssel + Gemeindeliste) in der Datenbank gespeichert.
3. Sobald im Admin-Tool eine Warnung „sofort aktiv“ gespeichert wird (oder die Auto-Gewitterwarnung greift), sucht der Server alle Abos, deren Gemeindeliste sich mit den Warnregionen überschneidet, und schickt ihnen eine Push-Nachricht (Titel, Gemeinden, Beschreibung, Link auf die Warnkarte).
4. Klick auf die Meldung öffnet `/karten/warnungen`.
5. Voraussetzungen: HTTPS-Seite (Preview/veröffentlichte Domain), auf iPhone/iPad muss die Seite zuerst zum Home-Bildschirm hinzugefügt werden, sonst sind Push-Meldungen systemseitig nicht möglich.

## Was ich ändere (nur UI/Verständlichkeit)

1. **Gemeinde-Chips eindeutig machen**
   - Ausgewählte Chips: Häkchen-Icon + Farbe, nicht ausgewählte: leerer Kreis, deutlich blasser + Rahmen.
   - `aria-pressed` für Screenreader/Barrierefreiheit.
2. **Kopfzeile über der Liste**: „Gewählte Gemeinden: X von Y“ plus die Aktionen „Alle“ / „Keine“.
3. **Aktiv-Button klarer**
   - Bei 0 gewählten Gemeinden ist „Benachrichtigungen aktivieren“ deaktiviert mit Hinweistext „Mindestens eine Gemeinde wählen“ (statt still auf „alle“ zurückzufallen).
   - Im aktivierten Zustand: grüner Status-Hinweis „Aktiv für X Gemeinden“ über dem Ausschalten-Button.
4. **Kurzer Erklärtext / Ausklapper „Wie funktioniert das?“** mit den Punkten 1–5 oben in Kurzform, inkl. iOS-Hinweis (Home-Bildschirm).
5. **Statusmeldungen** (aktiviert / abgelehnt / nicht unterstützt) bleiben, werden aber farblich als Erfolg bzw. Fehler unterschieden.

## Technische Details

Alle Änderungen bleiben in `src/components/warnings/push-opt-in.tsx`; Server-Funktionen, Datenbank und Versandlogik werden nicht angefasst. Farben über bestehende Design-Tokens, keine fixen Hex-Werte.
