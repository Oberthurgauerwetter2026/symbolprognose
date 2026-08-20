# Warnungen auf die WordPress-Seite verlinken

Ziel: Klicks im Warnpanel und in Push-Meldungen führen auf die WordPress-Seite
`https://www.oberthurgauerwetter.ch/warnkarte/` statt in die Lovable-App.

## Warnpanel (Warnkarte)

- Ortsnamen bei aktiven Warnungen werden klickbar und öffnen die WP-Warnkartenseite in einem neuen Tab.
- Auch die Warn-Einträge im Panel (Gefahr + Stufe) werden anklickbar und führen auf dieselbe Seite.
- Im Embed-/Widget-Modus (Einbettung auf der WP-Seite selbst) öffnet der Link die Seite im übergeordneten Fenster, nicht im iframe — so landet der Besucher nicht in einer Seite-in-Seite-Ansicht.
- Optik bleibt gleich, nur Hover-Unterstreichung und Zeigerhand als Hinweis auf den Link.

## Push-Meldungen

- Die Klick-Ziel-URL der Push-Meldung zeigt künftig auf `https://www.oberthurgauerwetter.ch/warnkarte/`.
- Der Hinweis „Details: oberthurgauerwetter.ch" im Meldungstext bleibt.

## Technische Details

- Neue Konstante `WP_WARN_URL = "https://www.oberthurgauerwetter.ch/warnkarte/"` in `src/lib/warnings-config.ts`, damit App und Push dieselbe Quelle nutzen.
- `src/components/maps/warn-map.tsx`: Ortsname-Überschrift und die Warnlisten-Einträge in `<a>`-Elemente umbauen; `target="_top"` wenn `bare`/Embed aktiv ist, sonst `target="_blank" rel="noopener"`.
- `src/lib/push.server.ts`: `url:` im Push-Payload auf `WP_WARN_URL` umstellen (statt `${SITE_URL}/karten/warnungen`).
- Service-Worker-Klickhandler prüfen, dass eine externe URL korrekt per `clients.openWindow` geöffnet wird; falls dort nur interne Pfade behandelt werden, entsprechend anpassen.
- Keine Änderungen an Warnlogik, Schwellen oder Datenmodell.
