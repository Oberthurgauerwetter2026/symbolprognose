# Warn-Meldungen: Hilfe für alle Browser

## Ausgangslage

Aktuell zeigt die Warnkarte bei iPhone/iPad nur einen Weg: „Bitte in Safari öffnen“. Wer Chrome, Edge oder Firefox auf dem iPhone nutzt, wird weggeschickt, obwohl auch dort ein Weg existiert. Auf Android und am Computer braucht es gar keine Installation, das wird heute nicht erklärt.

## Was gilt technisch (kurz)

- iPhone/iPad: Warn-Meldungen funktionieren nur aus einer auf dem Home-Bildschirm gespeicherten Web-App, ab iOS 16.4. Auch Chrome, Edge und Firefox auf dem iPhone können die Seite über „Teilen → Zum Home-Bildschirm“ speichern; das Ergebnis funktioniert danach gleich wie über Safari.
- Echte In-App-Browser (Facebook, Instagram, LinkedIn, Threads usw.) können nichts speichern. Dort bleibt nur: Seite im normalen Browser öffnen.
- Android (Chrome, Edge, Samsung Internet, Firefox): Warn-Meldungen lassen sich direkt aktivieren, Installation optional.
- Computer: Chrome, Edge und Firefox direkt. Safari am Mac braucht „Zum Dock hinzufügen“.
- Nicht möglich: eingebettete Karte im WordPress-Fenster (dort Link zur Warnkarte nutzen).

## Umsetzung

1. Browser-Erkennung erweitern: Gerätefamilie (iPhone/iPad, Android, Computer) und Browser (Safari, Chrome, Edge, Firefox, Samsung, In-App) getrennt bestimmen.
2. Statt einer einzigen Safari-Anleitung eine passende Anleitung je Fall anzeigen:
   - iPhone mit Chrome/Edge/Firefox: Schritte für „Teilen → Zum Home-Bildschirm → Web-App“ in genau diesem Browser, plus Hinweis „geht auch in Safari“.
   - iPhone mit Safari: bestehende Anleitung.
   - In-App-Browser: Adresse kopieren / im Browser öffnen (wie heute).
   - Android: direkter Aktivieren-Knopf, Installation nur als Tipp.
   - Computer: direkter Aktivieren-Knopf, für Safari am Mac der Dock-Hinweis.
   - Zu altes iOS: Hinweis auf Update.
3. Kurze Übersicht „Wo funktionieren Warn-Meldungen?“ als aufklappbarer Text, damit jede Person den eigenen Fall findet.
4. Text im Fussbereich der Warnkarte entsprechend anpassen (nicht mehr „nur in Safari“).

## Technische Details

- Datei: `src/components/warnings/push-opt-in.tsx` — `detectIos()` wird zu einer allgemeineren Umgebungserkennung, die Panels werden nach Fall aufgeteilt.
- Keine Änderungen an Datenbank, Push-Versand oder Manifest-Endpunkt; die Manifest-Korrektur von vorhin bleibt und muss nur veröffentlicht werden.
