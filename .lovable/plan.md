## Ziel

Kein DNS, kein Cyon-Webhosting, keine Subdomain. Die App läuft unter der Lovable-URL `warnkarte-oberthurgau.lovable.app`. Deine WordPress-Seite bindet die Warnkarte per Iframe ein; Benachrichtigungen aktivieren Nutzer über einen Button, der die App in einem eigenen Tab öffnet.

## Warum das funktioniert

Push-Benachrichtigungen brauchen nur eine **stabile HTTPS-Origin** — es muss keine eigene Domain sein. `warnkarte-oberthurgau.lovable.app` erfüllt das vollständig: Service Worker, Berechtigungen und Abos bleiben dauerhaft an diese Adresse gebunden.

## Umsetzung

**1. Lovable-URL umbenennen**
Beim nächsten Publish setze ich den Slug auf `warnkarte-oberthurgau`. Neue Adresse: `https://warnkarte-oberthurgau.lovable.app`

**2. Domain-Referenzen im Code zurückbauen**
- `src/lib/site-url.ts`: `SITE_URL` von `warnkarte.oberthurgauerwetter.ch` auf `https://warnkarte-oberthurgau.lovable.app` ändern; die veraltete `LOVABLE_ORIGIN`-Konstante entfernen.
- `src/routes/embed-info.tsx`: `PUBLISHED_ORIGIN` auf die neue Lovable-URL setzen.
- `src/routes/__root.tsx` und `src/routes/karten.warnungen.tsx`: `canonical` und `og:url` auf die neue Adresse anpassen.

**3. WordPress-Snippet**
Auf `/embed-info` steht dann das fertige Snippet zum Kopieren:

```html
<iframe src="https://warnkarte-oberthurgau.lovable.app/embed/warnungen"
        style="width:100%;height:760px;border:0" loading="lazy"></iframe>
```

**4. Hinweis-Button prüfen**
Im Embed erscheint „Warnungen abonnieren – in eigenem Tab öffnen". Ich stelle sicher, dass er auf `https://warnkarte-oberthurgau.lovable.app/karten/warnungen` zeigt und im Iframe klar sichtbar platziert ist.

**5. Publizieren** und die Karte im Live-Embed gegenprüfen.

## Was du danach machst

Auf deiner WordPress-Seite einen Block „Individuelles HTML" einfügen und das Snippet aus Schritt 3 einsetzen. Keine DNS-Einstellungen, kein Cyon-Eingriff nötig.

## Einschränkung

Die Adresse enthält weiterhin `lovable.app` statt deiner eigenen Domain. Deine Nutzer sehen sie nur, wenn sie auf den Abonnieren-Button klicken — die eingebettete Karte selbst zeigt keine URL. Falls dir das später doch zu unpassend wird, lässt sich eine eigene Domain jederzeit nachträglich verbinden, ohne dass die Einbindung neu gebaut werden muss.
