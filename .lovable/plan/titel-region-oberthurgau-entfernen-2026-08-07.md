# Titel "Region Oberthurgau" entfernen

## Ziel
Den Titel "Region Oberthurgau" aus dem Info-Panel der Warnkarte entfernen, damit der Screen auf der WP-Webseite und in der App kompakter wirkt.

## Änderung
- Datei: `src/components/maps/warn-map.tsx`
- Entfernen der Zeile, die im nicht-ausgewählten Zustand "Region Oberthurgau" als `h2` rendert (Zeile ~667).
- Wenn eine Gemeinde ausgewählt ist, soll der Gemeindename weiterhin als Titel angezeigt werden.
- Optional: Abstand des darunterliegenden Hinweistextes leicht anpassen, falls der fehlende Titel das Layout zu eng macht.

## Validierung
- TypeScript-Check und Production-Build erfolgreich.
- Playwright-Screenshot der Warnkarte verifiziert, dass "Region Oberthurgau" nicht mehr erscheint und Gemeinde-Namen bei Auswahl weiterhin sichtbar sind.
