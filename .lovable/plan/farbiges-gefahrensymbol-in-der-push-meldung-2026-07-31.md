# Farbiges Gefahrensymbol in der Push-Meldung

## Ziel

Push-Meldungen zeigen künftig nicht das App-Logo, sondern das Gefahrensymbol (Blitz, Regentropfen, Schneeflocken, Strassenglätte, Windsack, Frost) auf der Fläche der jeweiligen Warnstufe (gelb / orange / rot).

Wichtig zur Erwartungshaltung: Auf Android/Chrome und Desktop wird dieses Symbol angezeigt. iOS/iPadOS ersetzt das Symbol einer Web-Push-Meldung immer durch das Home-Bildschirm-Icon der App — dort bleibt es daher beim bestehenden Logo. Das ist eine Vorgabe von Apple und lässt sich nicht umgehen. Und im Textfeld drinnen?

## Umsetzung

1. Symbolbilder erzeugen: 18 PNG-Dateien (6 Gefahren × 3 Stufen), 192×192 px, unter `public/warn-icons/<gefahr>-<stufe>.png`. Motiv: abgerundete Fläche in der Stufenfarbe, darauf das bestehende Gefahrensymbol in der Kontrastfarbe. Grundlage sind die vorhandenen Symbole aus `src/components/warnings/hazard-icons.tsx` und die Farben aus `LEVELS` in `src/lib/warnings-config.ts` — es entstehen keine neuen, abweichenden Symbole.
2. Push-Versand: die Meldung erhält zusätzlich die Adresse des passenden Symbols; fehlt sie, wird wie bisher das App-Logo verwendet.
3. Das kleine Monochrom-Badge (Statusleiste Android) bleibt das App-Icon.

## Technische Details

- Einmaliges Generierungsskript im Sandbox-Lauf: Icon-Komponenten via `renderToStaticMarkup` zu SVG rendern (Stufenhintergrund als `<rect rx>`, Symbol skaliert/zentriert, `currentColor` → `LEVELS[l].textOnColor`), dann mit `sharp` nach PNG rastern und in `public/warn-icons/` ablegen. Das Skript bleibt nicht im Projekt; die PNGs werden eingecheckt.
- `src/lib/push.server.ts`: Payload-Typ um `icon?: string` erweitern; beim Versand `icon: \`${SITE_URL}/warn-icons/${warning.hazard}-${level}.png` setzen (nur wenn Gefahr in der Liste bekannt ist).
- `public/push-sw.js`: `icon: payload.icon || "/icon-192.png"`, `badge` unverändert.
- Keine Datenbank- oder Schema-Änderungen.