# Strassenglätte-Symbol überarbeiten + Push-Meldung öffnet Warnkarte

## Ziel
1. Das bisherige Strassenglätte-Symbol wird durch ein professionelleres, verkehrszeichen-ähnliches Symbol ersetzt (Auto auf schlängelnden Linien, ohne rotes Warn-Dreieck). Alle Stellen, die das Symbol nutzen, werden automatisch über die gemeinsame SVG-Quelle aktualisiert.
2. Beim Klick auf eine Push-Benachrichtigung öffnet sich die App-Warnkarte (`/karten/warnungen`), nicht mehr die externe WordPress-Seite.

## Ausgangslage

### Symbol
- Die Gefahren-Symbole werden zentral in `src/components/warnings/hazard-svg.ts` als SVG-Markup definiert.
- `src/components/warnings/hazard-icons.tsx` exportiert `SlipperyCarIcon` und wird in `src/lib/warnings-config.ts` für `id: "glaette"` verwendet.
- Die 18 Push-Benachrichtigungs-Icons in `public/warn-icons/` werden aus derselben SVG-Quelle über `scripts/gen-warn-icons.ts` generiert.
- Das hochgeladene Bild zeigt das offizielle Verkehrszeichen «Schleudergefahr» und dient als Form-Vorlage.

### Push-Weiterleitung
- `public/push-sw.js` hat bereits einen `notificationclick`-Handler, der `event.notification.data.url` öffnet, mit Fallback `/karten/warnungen`.
- In `src/lib/push.server.ts` wird jedoch `url: "https://oberthurgauerwetter.ch"` mitgegeben, weshalb aktuell die externe WP-Seite geöffnet wird.
- `SITE_URL` ist bereits importiert und kann verwendet werden, um die App-URL dynamisch zu setzen.

## Umsetzung

### 1. Neues Strassenglätte-Symbol
- In `src/components/warnings/hazard-svg.ts` das `SLIPPERY`-SVG-Markup neu zeichnen:
  - 24×24-ViewBox, passend zu `SVG_ROOT_ATTRS` (currentColor, stroke).
  - Motiv: schlichtes Auto in Seitenansicht mit zwei wellenförmigen Schlängel-Linien darunter (wie im Verkehrszeichen, aber ohne rotes Dreieck).
  - Stil: flächig, aber im 24-px-Raster lesbar; Linienstärke und Proportionen an die anderen Gefahren-Symbole angeglichen.
  - Keine neuen IDs, keine neuen Farben, keine Textänderungen.
- Push-Icons neu generieren: `bun scripts/gen-warn-icons.ts` und die drei PNG-Dateien `public/warn-icons/glaette-1/2/3.png` ersetzen (gleiche Dateinamen, damit `src/lib/push.server.ts` unverändert bleibt).
- Visuelle Kontrolle: Karte, Legende, Admin-Chips, Vorschau und generierte PNGs zeigen das gleiche Symbol.

### 2. Push-Meldung öffnet Warnkarte
- In `src/lib/push.server.ts` den `url`-Wert von `sendPush` ändern:
  - Statt `url: "https://oberthurgauerwetter.ch"` → `url: \`${SITE_URL}/karten/warnungen\``.
  - Damit öffnet sich beim Klick auf die Meldung die App-Warnkarte in einem neuen/aktuellen Tab.
- `public/push-sw.js` bleibt unverändert, da der Handler bereits `data.url` öffnet und den Fallback `/karten/warnungen` hat.
- Optional prüfen: Soll die URL spezifisch auf die betroffene Warnung zoomen (z. B. Hash/Search-Param mit `warning.id`)? Für diese Planung reicht die allgemeine Warnkarte; falls gewünscht, kann das später ergänzt werden.

## Technische Details
- Reine Änderung des SVG-Innern für `glaette` in `HAZARD_SVG_INNER`; kein Touch an `HAZARDS`, `LEVELS`, `hazard-icons.tsx` oder `push.server.ts` (außer der URL-Zeile).
- Keine Schema- oder Datenbankänderungen.
- Kein externes Bild-Asset; das Symbol bleibt vektorbasiert.
