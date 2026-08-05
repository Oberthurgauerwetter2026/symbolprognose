# Strassenglätte-Symbol professionell überarbeiten

## Ziel
Das bisherige Strassenglätte-Symbol (`SlipperyCarIcon`) wird durch ein professionelleres, verkehrszeichen-ähnliches Symbol ersetzt: Auto auf schlängelnden Linien, ohne rotes Warn-Dreieck. Alle Stellen, die das Symbol nutzen, werden automatisch über die gemeinsame SVG-Quelle aktualisiert.

## Ausgangslage
- Die Gefahren-Symbole werden zentral in `src/components/warnings/hazard-svg.ts` als SVG-Markup definiert.
- `src/components/warnings/hazard-icons.tsx` exportiert `SlipperyCarIcon` und wird in `src/lib/warnings-config.ts` für `id: "glaette"` verwendet.
- Die 18 Push-Benachrichtigungs-Icons in `public/warn-icons/` werden aus derselben SVG-Quelle über `scripts/gen-warn-icons.ts` generiert (siehe Plan `push-symbole-an-kartensymbole-angleichen`).
- Das hochgeladene Bild zeigt das offizielle Verkehrszeichen «Schleudergefahr» und dient als Form-Vorlage.

## Umsetzung

1. Neues SVG-Markup für `glaette` in `src/components/warnings/hazard-svg.ts` zeichnen.
   - 24×24-ViewBox, passend zu `SVG_ROOT_ATTRS` (currentColor, stroke).
   - Motiv: schlichtes Auto in Seitenansicht mit zwei wellenförmigen Schlängel-Linien darunter (wie im Verkehrszeichen, aber ohne rotes Dreieck).
   - Stil: flächig, aber im 24-px-Raster lesbar; Linienstärke und Proportionen an die anderen Gefahren-Symbole angeglichen, damit es in der Karte, Legende und Chips nicht stärker auffällt als die Nachbarn.
   - Keine neuen IDs, keine neuen Farben, keine Textänderungen.

2. Push-Icons neu generieren.
   - `bun scripts/gen-warn-icons.ts` ausführen.
   - Die 3 PNG-Dateien `public/warn-icons/glaette-1.png`, `glaette-2.png`, `glaette-3.png` ersetzen (gleiche Dateinamen, damit `src/lib/push.server.ts` unverändert bleibt).
   - Kontrolle: Karten-Legende, Admin-Tool und generierte PNGs zeigen das gleiche Strassenglätte-Symbol.

3. Visuelle Kontrolle.
   - Warnkarte und Embed-Ansicht prüfen: Symbol bei Stufe 1–3 lesbar und im Stil konsistent.
   - Admin-Tool: Auswahlchip und Vorschau prüfen.

## Technische Details
- Reine Änderung des SVG-Innern für `glaette` in `HAZARD_SVG_INNER`; kein Touch an `HAZARDS`, `LEVELS`, `hazard-icons.tsx` oder `push.server.ts`.
- Keine Schema- oder Datenbankänderungen.
- Kein externes Bild-Asset; das Symbol bleibt ein vektorbasiertes SVG.
