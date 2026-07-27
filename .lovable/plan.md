## Warum die Meldung erscheint

In `src/components/warnings/push-opt-in.tsx` (Zeile 63/64) wird beim Klick auf „Benachrichtigungen aktivieren“ `Notification.requestPermission()` aufgerufen. Liefert der Browser etwas anderes als `"granted"` zurück, wird pauschal „Benachrichtigungen wurden nicht erlaubt.“ angezeigt.

Typische Ursachen, die aktuell alle gleich aussehen:
1. **Vorschau im eingebetteten Fenster** – die App läuft in der Lovable-Vorschau in einem Frame; Browser lehnen die Berechtigungsabfrage dort ohne Rückfrage ab. In der veröffentlichten Version bzw. in einem eigenen Tab funktioniert sie.
2. **Berechtigung früher abgelehnt** (`Notification.permission === "denied"`) – der Browser fragt dann nie wieder; man muss die Einstellung in der Adressleiste/Website-Einstellungen zurücksetzen.
3. **Dialog weggeklickt** (`"default"`) – einfach nochmals versuchen.
4. **iPhone/iPad** – Push funktioniert nur, wenn die Seite zuvor über „Zum Home-Bildschirm“ installiert wurde.

## Vorgeschlagene Verbesserung

In `src/components/warnings/push-opt-in.tsx`:
- Vor dem Aufruf prüfen, ob die Seite in einem Frame läuft (`window.top !== window.self`) und dann statt der generischen Fehlermeldung den Hinweis „Bitte die Seite in einem eigenen Browser-Tab öffnen“ mit Link auf die Seite (`target="_blank"`) zeigen.
- Rückgabewert differenziert auswerten:
  - `denied` → Text „Benachrichtigungen sind für diese Seite blockiert. In den Website-Einstellungen des Browsers (Schloss-Symbol in der Adressleiste) wieder erlauben und erneut versuchen.“
  - `default` → „Die Abfrage wurde abgebrochen – bitte nochmals auf ‚Benachrichtigungen aktivieren‘ tippen.“
- Zusätzlich beim Laden `Notification.permission` auslesen und bei `denied` schon vorab einen Hinweis über dem Button einblenden, statt erst nach dem Klick.
- iOS-Hinweis (Home-Bildschirm) wird im bestehenden Ausklapper „Wie funktioniert das?“ prominenter platziert.

Keine Backend-Änderungen nötig.
