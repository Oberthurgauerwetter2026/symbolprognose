# Push-Hilfe auf iPhone zuverlässig anzeigen

## Ziel
Die Warnkarte darf bei fehlender Push-Unterstützung nicht mehr nur „Dieser Browser unterstützt keine Push-Benachrichtigungen“ anzeigen. Stattdessen erhält die Person immer eine passende, sichtbare Anleitung.

## Umsetzung
- Die iPhone-/iPad-Erkennung robuster machen, zusätzlich über Geräteplattform und Touch-Unterstützung.
- Die Anzeige erst nach abgeschlossener Browser-Erkennung entscheiden, damit der anfängliche Standardwert nicht den falschen Hinweis zeigt.
- Den bisherigen Ein-Zeilen-Fallback durch ein Hilfefeld ersetzen:
  - auf iPhone/iPad: Schritte „Teilen → Zum Home-Bildschirm → Web-App → Hinzufügen“;
  - in eingebetteten Ansichten: Link zum Öffnen der Warnkarte in einem eigenen Tab;
  - auf anderen nicht unterstützten Browsern: verständlicher Hinweis plus aufklappbare Übersicht der unterstützten Geräte.
- Sicherstellen, dass „Anleitung für dein Gerät“ auch dann sichtbar bleibt, wenn `PushManager` oder Service Worker im aktuellen Browserfenster fehlen.

## Prüfung
- iPhone-Browseransicht ohne installierte Web-App simulieren und die sichtbaren Installationsschritte prüfen.
- Eingebettete Ansicht sowie einen Browser ohne Push-Unterstützung prüfen.
- Projektprüfung und Live-Ausgabe kontrollieren; anschließend muss die korrigierte Fassung erneut veröffentlicht werden.

## Technische Details
Die Änderung bleibt auf die Anzeige- und Geräteerkennung im bestehenden Push-Abo-Bereich begrenzt. Abo-Speicherung, Gemeinden und Push-Versand werden nicht verändert.
