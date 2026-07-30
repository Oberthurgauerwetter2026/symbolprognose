## Ziel

Das Strassenglätte-Symbol soll exakt dem Verkehrszeichen «Schleudergefahr» aus dem Screenshot entsprechen: ein Auto in leichter Schräg-/Frontansicht mit zwei geschwungenen S-Spuren darunter — ohne rotes Dreieck, damit es sich in Stil und Farbe (currentColor) in die übrigen Gefahrensymbole einfügt.

## Umsetzung

Datei: `src/components/warnings/hazard-icons.tsx` → `SlipperyCarIcon`

- Fahrzeug neu zeichnen als kompakte, gefüllte Silhouette in Schrägansicht (Dach/Kabine leicht versetzt, breite Karosserie, zwei sichtbare Räder unten links/rechts), analog zum Zeichen — statt der aktuellen reinen Umrisszeichnung von hinten.
- Fahrzeug im oberen Drittel des 24×24-Viewbox platzieren (ca. y 4–13), damit unten Platz für die Spuren bleibt.
- Zwei getrennte, deutlich geschwungene S-Kurven darunter (ca. y 15–21), leicht versetzt und unterschiedlich lang, mit runden Enden — nicht als durchgehende Wellenlinie, sondern als zwei erkennbare Schleuderspuren wie im Screenshot.
- Strichstärken so wählen, dass das Symbol auch bei 16–20 px klar lesbar bleibt (Auto gefüllt, Spuren als Strich mit ~1.8).

Alle Verwendungsstellen (Banner, Info-Liste, Legende, Admin) beziehen das Symbol aus dieser Datei — es ist also nur diese eine Änderung nötig.

## Prüfung

Playwright-Screenshot der Warnkarte mit Zoom auf die Symbolleiste, Vergleich mit dem Referenzbild; bei Bedarf Feinjustierung von Proportionen und Abständen.
