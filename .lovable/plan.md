Ziel: Die Warnkarte soll auf der WordPress-Seite `oberthurgauerwetter.ch` eingebettet werden können UND Benachrichtigungen sollen für die Nutzer funktionieren.

Kernproblem: Web-Push (Service Worker + Notification-Berechtigung) funktioniert in einem cross-origin Iframe praktisch nicht. Die Lösung ist eine Kombination aus eigener Domain, PWA-Installierbarkeit und einem schlanken Embed, das zur eigenständigen App verlinkt.

## Schritt 1: PWA-Manifest für Installierbarkeit

- `public/manifest.webmanifest` erstellen mit:
  - `name: "Wetterwarnungen Oberthurgau"`
  - `short_name: "Warnungen"`
  - `start_url: "/karten/warnungen"`
  - `scope: "/"`
  - `display: "standalone"` (oder `minimal-ui`)
  - Theme-/Background-Farben passend zur App
  - Icon-Referenzen (z.B. auf vorhandenes Favicon oder neu generierte 192x192/512x512 Icons)
- Head-Metadaten in `src/routes/__root.tsx` erweitern:
  - `<link rel="manifest" href="/manifest.webmanifest">`
  - `apple-touch-icon`
  - `theme-color`
- Dies ermöglicht „Zum Home-Bildschirm hinzufügen“, was für iOS Push zwingend nötig ist.

## Schritt 2: Dedizierte Embed-Route für die Warnkarte

- Neue Route `src/routes/embed.warnungen.tsx` unter `/embed/warnungen`:
  - Nutzt `EmbedShell` (ohne Dashboard-Layout/Header/Sidebar)
  - Zeigt nur die `WarnMap`
  - Kein Push-Opt-In direkt im Iframe
  - Zeigt stattdessen einen kleinen, klaren Hinweis: „Für Push-Benachrichtigungen die Warnkarte in eigenem Tab öffnen“ mit Link zur eigenständigen App
- Cache-Header via `setEmbedCacheHeaders` setzen (wie bestehende Embed-Routen).

## Schritt 3: Push-Opt-In auf der eigenständigen Seite verbessern

- In `src/components/warnings/push-opt-in.tsx` und der Warnkarte:
  - Wenn die Seite im Iframe erkannt wird (`framed === true`), Push-Dialog deaktivieren und stattdessen einen prominenten Button/Link anzeigen: „In eigenem Tab öffnen, um Benachrichtigungen zu aktivieren“
  - Der Link führt zur eigenständigen App-URL.
- Auf der eigenständigen Seite `/karten/warnungen` bleibt der normale Push-Registrierungs-Flow erhalten.

## Schritt 4: Custom Domain (zwingend für die richtige Adresse)

- Eine Subdomain der WP-Domain verwenden, z.B. `warnkarte.oberthurgauerwetter.ch` oder `wetterwarnungen.oberthurgauerwetter.ch`.
- Voraussetzung: Domain ist beim Nutzer verwaltbar (DNS A-Record auf `185.158.133.1` + TXT-Record für Verifikation).
- In Lovable: Projekt veröffentlichen → Projekt-Einstellungen → Domains → Custom Domain hinzufügen.
- Wichtig: Die App läuft dann unter der Domain des Nutzers. Der Service Worker ist dann unter dieser Domain registriert, was für Push nötig ist. Die WP-Hauptseite (`oberthurgauerwetter.ch`) und die App-Subdomain sind zwar technisch weiterhin cross-origin, aber die Nutzer öffnen die App direkt in der Subdomain für Push.

## Schritt 5: WordPress-Einbindung

- In WordPress anstelle der vollen App nur das Embed-Frame einbinden:
  ```html
  <iframe src="https://warnkarte.oberthurgauerwetter.ch/embed/warnungen"
          width="100%" height="700" frameborder="0"
          allow="geolocation"
          loading="lazy"
          title="Wetterwarnungen Oberthurgau">
  </iframe>
  ```
- Zusätzlich einen auffälligen Button/Link in WP platzieren: „Warnkarte mit Benachrichtigungen öffnen“ → verlinkt zur eigenständigen App `https://warnkarte.oberthurgauerwetter.ch/karten/warnungen`.
- Damit sehen die Besucher die Karte direkt in WP, und wer Push will, öffnet die App in einem eigenen Tab.

## Schritt 6: Favicon / Icons prüfen

- Falls `public/favicon.ico` existiert, wird es als Push-Icon verwendet.
- Für bessere PWA-Installierbarkeit und Push-Icon 192x192 + 512x512 PNGs bereitstellen oder generieren.

## Offene Frage vor Umsetzung

- Welche Subdomain soll verwendet werden? (Vorschlag: `warnkarte.oberthurgauerwetter.ch` oder ein anderer Wunschname)
- Soll ich direkt alle Schritte 1–5 umsetzen, oder zuerst nur den Embed + PWA-Teil, damit du die Domain später selbst verbindest?