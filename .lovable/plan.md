# Stundenprognose stabilisieren und Regentropfen verfeinern

## Umsetzung

- Die horizontale Wischgeste der kompakten und vollständigen Stundenprognose klar auf die X-Achse begrenzen, damit sich beim seitlichen Scrollen nicht mehr die ganze Seite und damit das Panel hoch oder runter bewegt.
- Das horizontale Überziehen am Anfang und Ende der Leiste begrenzen, ohne normales vertikales Scrollen ausserhalb des Stundenpanels zu beeinträchtigen.
- Die bestehenden festen Höhen für Uhrzeit, Wettersymbol, Temperatur und Wind beibehalten, damit auch der Inhalt innerhalb der Leiste stabil bleibt.
- Regentropfen nochmals sichtbar schmaler zeichnen und die Füllung leicht bläulicher abstimmen; Kontur und helles Highlight bleiben dezent und wetterdiensttauglich.
- Dieselbe Tropfenform und Farbe in der normalen Lokalprognose und in den eingebetteten Prognose-SVGs verwenden.

## Prüfung

- Auf einem mobilen Viewport die kompakte und vollständige Stundenprognose mehrfach horizontal wischen und kontrollieren, dass das Panel vertikal ruhig bleibt.
- Den Übergang vom 1-Stunden- zum 3-Stunden-Takt prüfen.
- Regen-, Schauer- und Gewittersymbole visuell auf Abstand, Farbe und Animation kontrollieren.
- Typprüfung und Vorschau-Build ohne Fehler abschliessen.

## Technische Details

Die Scrollflächen erhalten eine explizite horizontale Touch-Ausrichtung und begrenztes horizontales Overscroll-Verhalten. Die Tropfengeometrie und Farbwerte werden in React- und serverseitiger SVG-Ausgabe synchron angepasst; Animationsdauer und Fallbewegung bleiben unverändert.
