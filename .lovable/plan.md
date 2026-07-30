## Ziel

Zwei Warnsymbole in `src/components/warnings/hazard-icons.tsx` neu zeichnen, damit sie auch klein (ca. 24–40 px) klar lesbar sind.

### 1. Strassenglätte (`SlipperyCarIcon`)

Aktuell verschmelzen die gefüllte Karosserie, die Räder und die drei Schleuderspuren bei kleiner Darstellung zu einem unleserlichen Klecks (siehe Screenshot).

Neu, nah am Verkehrszeichen «Schleudergefahr»:
- Auto als **kompakte, klar konturierte Silhouette** im oberen Bilddrittel, breiter und flacher, Räder als zwei ausgesparte/abgesetzte Blöcke statt kleiner Anhängsel.
- Nur **zwei** Schleuderspuren statt drei, dafür deutlich grösser geschwungen (S-Kurven), mit klarem Abstand zum Fahrzeug, damit sie nicht mit der Karosserie verlaufen.
- Mehr Weissraum zwischen Auto und Spuren; Linienstärke der Spuren auf gute Sichtbarkeit abgestimmt.
- Formen so dimensionieren, dass die Silhouette auch bei 20 px als Auto erkennbar bleibt.

### 2. Windsack (`WindsockIcon`)

Nach Vorlage des zweiten Screenshots:
- **Kräftiger, dicker Mast** links (abgerundet), deutlich stärker als bisher.
- Sack als **gefüllte Silhouette** in Kegelform, die nach rechts schmaler wird, mit abgerundeter Spitze.
- **Drei sichtbar getrennte Segmente** – erzeugt durch schmale Aussparungen/Trennlinien in Hintergrundfarbe bzw. als drei einzelne gefüllte Segmente mit Lücke, sodass die Streifen auch klein erkennbar bleiben.
- Leichte Neigung nach unten-rechts wie in der Vorlage.

### Technisch

- Nur `src/components/warnings/hazard-icons.tsx` wird angepasst (SVG-Pfade von `SlipperyCarIcon` und `WindsockIcon`); Props/Exports/Namen bleiben unverändert, damit Warnkarte, Banner, Admin-Tool und Widgets ohne Änderung weiterlaufen.
- Beide Icons bleiben `currentColor`-basiert (24×24 viewBox), damit Warnstufen-Farben weiter greifen.
- Verifizierung per Playwright: Element-Screenshots der Symbole auf `/karten/warnungen` bei kleiner und grosser Darstellung, um die Lesbarkeit zu prüfen.
