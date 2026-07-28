## Ziel

Die Warnkarte läuft künftig unter **warnkarte.oberthurgauerwetter.ch**. Auf der WordPress-Seite bleibt die Karte als Iframe eingebettet, mit einem gut sichtbaren Button „In eigenem Tab öffnen“ – dort funktionieren dann auch die Push-Benachrichtigungen.

## Was du selbst machen musst (Domain)

1. In Lovable: **Project Settings → Domains → Connect Domain** → `warnkarte.oberthurgauerwetter.ch` eintragen.
2. Beim Domain-Provider die angezeigten DNS-Einträge setzen (A-Record `warnkarte` → 185.158.133.1 + TXT `_lovable`).
3. Warten bis Status „Active“ (meist Minuten, max. 72 h), danach publizieren.

Erst danach greifen Push-Benachrichtigungen unter deiner eigenen Domain.

## Was ich umsetze

1. **Domain-Konstante**: eine zentrale Stelle mit der App-URL (`https://warnkarte.oberthurgauerwetter.ch`), die überall statt der Lovable-URL verwendet wird. Solange die Domain noch nicht aktiv ist, fällt sie automatisch auf die aktuelle Origin zurück, damit nichts bricht.
2. **Push-Opt-In im Iframe**: Der Button „In eigenem Tab öffnen“ zeigt auf die neue Domain (`/karten/warnungen`) statt auf die Iframe-URL, damit Service Worker und Berechtigung dort registriert werden.
3. **Prominenter Button in der Embed-Ansicht**: In `/embed/warnungen` kommt oben bzw. unter der Karte ein deutlich sichtbarer Button „Warnungen abonnieren – in eigenem Tab öffnen“, damit WP-Besucher den Weg finden.
4. **Meta/SEO/PWA**: `canonical`, `og:url`, `og:image` und das PWA-Manifest (`start_url`, `scope`) auf die neue Domain ausrichten; Titel/Beschreibung bleiben.
5. **Embed-Snippet aktualisieren**: In `/embed-info` das Iframe-Snippet für die Warnkarte auf die neue Domain umstellen, inkl. Copy-Paste-Code für WordPress (Custom-HTML-Block, responsive Höhe).

## Technische Details

- Neue Datei `src/lib/site-url.ts` mit `SITE_URL` und `getAppUrl(path)`; clientseitig `window.location.origin`-Fallback, damit Preview weiter funktioniert.
- `src/components/warnings/push-opt-in.tsx`: `pageUrl` aus `getAppUrl('/karten/warnungen')` statt aus der aktuellen Iframe-Location.
- `src/routes/embed.warnungen.tsx`: Button-Leiste ergänzen (`target="_blank" rel="noreferrer"`).
- `src/routes/__root.tsx` + `public/manifest.webmanifest`: URLs anpassen.
- `src/routes/embed-info.tsx`: Snippet-String aktualisieren.

## Hinweis

Push funktioniert pro Origin. Nutzer, die sich heute unter `symbolprognose.lovable.app` angemeldet haben, müssen sich unter der neuen Domain erneut anmelden – die alten Abos bleiben in der Datenbank, laufen aber über die alte Origin.
