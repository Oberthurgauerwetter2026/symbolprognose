# iOS-Push für die Warnkarte zuverlässig machen

## Was geprüft wurde

- Die Warnkarte liefert im Seitenkopf korrekt das eigene App-Profil (`/warnkarte.webmanifest`) und die Apple-Angaben.
- Auf der veröffentlichten Seite wird diese Profildatei aber mit dem falschen Dateityp ausgeliefert (`application/octet-stream` statt `application/manifest+json`). Lokal ist der Typ korrekt. Genau in diesem Fall ignoriert iOS das App-Profil — dann fehlt im Teilen-Menü die Zeile „Web-App“ und die Seite wird nur als Lesezeichen gespeichert. Ohne echte Web-App gibt es auf iOS keine Push-Meldungen.
- Die Adresse mit Schrägstrich am Ende (`/warnkarte/`) leitet um; das App-Profil begrenzt sich zudem auf `/warnkarte`, was bei Umleitungen zu einer Fehlzuordnung führen kann.

## Antwort auf die Frage

Auf iOS können Push-Meldungen grundsätzlich alle Nutzer erhalten, aber nur unter drei Bedingungen: iOS 16.4 oder neuer, die Seite wurde in **Safari** über „Teilen → Zum Home-Bildschirm“ als **Web-App** gespeichert, und die Meldungen wurden aus dieser Home-Bildschirm-App heraus aktiviert. In Chrome/Firefox auf iOS, in App-internen Browsern (Facebook, Instagram, Mail) und in eingebetteten Karten auf der WordPress-Seite ist Push auf iOS nicht möglich.

## Umsetzung

1. **Profildatei mit richtigem Dateityp ausliefern**: die Datei künftig über einen eigenen Server-Endpunkt bereitstellen, der `application/manifest+json` sendet, und den Verweis in der Warnkarte darauf zeigen lassen. Das ist der Kern-Fix für die fehlende „Web-App“-Zeile.
2. **Geltungsbereich erweitern**: im App-Profil den Bereich auf die ganze Seite setzen, damit auch die Adresse mit Schrägstrich am Ende in der App bleibt.
3. **Hilfe-Panel auf der Warnkarte**: erkennt automatisch die Situation und zeigt nur den passenden Hinweis:
   - App-internen Browser erkannt → „Bitte in Safari öffnen“ mit Kopier-Button für die Adresse.
   - Safari, aber noch nicht als App gespeichert → Schritt-für-Schritt: Teilen → Zum Home-Bildschirm → **Web-App** → Öffnen → Benachrichtigungen aktivieren.
   - Bereits als App geöffnet → direkt der Aktivieren-Knopf.
   - Zu altes iOS → klare Meldung, dass ein Update nötig ist.
4. **Anleitungstext** unter „Wie funktioniert das?“ auf diese Schritte kürzen und um den Hinweis „Web-App wählen, nicht Lesezeichen“ ergänzen.

## Technische Details

- Neuer Server-Route-Handler für `/warnkarte.webmanifest` (TanStack Server-Route) mit `Content-Type: application/manifest+json` und kurzer Cache-Zeit; `public/warnkarte.webmanifest` bleibt als Fallback.
- `scope` im Warnkarten-Profil von `/warnkarte` auf `/` ändern; `start_url` und `id` bleiben `/warnkarte`.
- Erkennung in `src/components/warnings/push-opt-in.tsx`: `navigator.standalone` / `display-mode: standalone`, iOS-Version aus dem User-Agent, In-App-Browser-Kennungen (FBAN, FBAV, Instagram, Line, CriOS, FxiOS).
- Hinweis: Wer die Seite schon als Lesezeichen gespeichert hat, muss sie einmal löschen und neu als Web-App hinzufügen.
