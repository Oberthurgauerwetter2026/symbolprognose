## Ziel
Die Push-Benachrichtigung soll nicht mehr als „from Warnkarte“ erscheinen, sondern einheitlich unter dem Marken-Label der App verschickt werden.

## Diagnose
Die Zeichenkette „from Warnkarte“ wird vom Betriebssystem/Browser automatisch an die Push-Notification gehängt; sie ist kein vom Service Worker gesetzter Text. Der Browser nimmt dafür den `short_name` aus dem Web-Manifest der installierten PWA. Die Warnkarte hat derzeit ein eigenes Manifest (`public/warnkarte.webmanifest`) mit `short_name: "Warnkarte"`, deshalb erscheint dieser Name in der Push-Quelle.

## Massnahmen
1. **`public/warnkarte.webmanifest`**
   - `short_name` von `"Warnkarte"` auf `"OT Wetter"` ändern (gleicher Kurzname wie Haupt-App-Manifest).
   - `name` von `"Warnkarte Oberthurgau"` auf `"Oberthurgauer Wetter"` ändern.
   - `start_url: "/warnkarte"` und `scope: "/warnkarte"` bleiben erhalten, damit iOS weiterhin nur die Warnkarte als App startet.

2. **`src/routes/warnkarte.tsx`**
   - `<meta name="apple-mobile-web-app-title" content="Warnkarte" />` auf `"Oberthurgauer Wetter"` ändern, damit iOS das gleiche Label verwendet.

3. **Verifizierung**
   - Build laufen lassen.
   - `/warnkarte` mit `curl` prüfen: `apple-mobile-web-app-title` und der Manifest-Link müssen auf das aktualisierte Manifest zeigen.
   - Manifest-Inhalt prüfen: `short_name` und `name` dürfen nicht mehr „Warnkarte“ enthalten.

## Nicht Teil des Plans
- Keine Änderung am Service Worker (`public/push-sw.js`) – dort ist kein „from Warnkarte“ enthalten.
- Keine Änderung an der Push-Payload in `src/lib/push.server.ts` – Titel/Text bleiben unverändert, da nur die vom Browser ergänzte Quelle angepasst werden muss.
- Keine Änderung an den Push-Inhalten (Titel, Body, Icon) – die UI-Texte bleiben wie bisher.