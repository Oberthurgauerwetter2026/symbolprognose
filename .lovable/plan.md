# Website-Link in Warnkarte und Warnmeldungen

## Ziel
Die eigene Webseite `oberthurgauerwetter.ch` in der Warnkarte sichtbar verlinken und in Push-Benachrichtigungen als Ziel/Link erwähnen.

## Geplante Änderungen

### 1. Warnkarte: Info-Panel Footer
- Datei: `src/components/maps/warn-map.tsx`
- Am unteren Rand des Info-Panels (innerhalb des `aside` neben der Karte, unabhängig von gewählter Gemeinde oder Warnstatus) einen Footer mit Link einfügen.
- Text-Vorschlag: „Weitere Details: oberthurgauerwetter.ch“
- Link: `https://oberthurgauerwetter.ch` mit `target="_blank"` und `rel="noopener noreferrer"`.
- Design: Dezente, aber gut lesbare Grösse (z. B. `text-sm`/`text-base`), passend zur Karten-UI.

### 2. Push-Benachrichtigung: Ziel und Text
- Datei: `src/lib/push.server.ts`
- `url` des Push-Payloads von `/karten/warnungen` auf `https://oberthurgauerwetter.ch` ändern, damit ein Klick auf die Meldung direkt zur Webseite führt.
- Notification-Body um einen Hinweis auf die Webseite ergänzen, z. B.:
  `… Gültig: ${period}. Details: oberthurgauerwetter.ch`
- Titel bleibt unverändert: „Gefahr (Stufe X) · Oberthurgauer Wetter“.

## Nicht im Scope
- Keine Änderungen an Warninhalten, Icons, Farben oder dem Karten-Hintergrund.
- Keine Änderungen an der Web-Manifest- oder PWA-Konfiguration.

## Verifikation
- Vorschau der Warnkarte öffnen und prüfen, ob der Link im Info-Panel sichtbar ist.
- Push-Logik prüfen: `url` und `body` enthalten `oberthurgauerwetter.ch`.