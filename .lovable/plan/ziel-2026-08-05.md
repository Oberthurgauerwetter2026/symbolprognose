Filmstrip: Rahmen-Hervorhebung beim Ziehen entfernen

## Ziel
Der Filmstrip soll beim Ziehen nicht mehr durch einen farbigen Rahmen (Ring) hervorgehoben werden. Das sonstige visuelle Feedback (Schatten, hellerer Verlauf, grössere Mittelmarkierung) bleibt erhalten, sofern es nicht unbeabsichtigt mit dem Rahmen verbunden ist.

## Änderung
- Datei: `src/components/maps/filmstrip-timeline.tsx`
- Betroffene Komponente: `FilmstripTimeline`

Konkrete Anpassungen:
  - Entferne `ring-2` aus der CSS-Klasse des Filmstrip-Containers während `dragging`.
  - Entferne die dynamische `--tw-ring-color` Setzung über Inline-Style, die die Rahmenfarbe auf die aktuelle Kartenfarbe (`color`) legt.
  - Belasse die restlichen Zustands-Styles (`shadow-lg`, hellerer Verlauf, grössere Mittelmarkierung), sofern sie nicht ebenfalls störend wirken.
  - Prüfe kurz, ob die Kombination aus `shadow-lg` und dem helleren Verlauf ohne Rahmen ausreichendes Feedback liefert; falls nicht, passe die verbleibenden Zustände leicht an.

## Nicht im Scope
- Keine Änderung der Scroll-/Momentum-Logik.
- Keine Änderung der Zeitformatierung, der Blasengrösse oder der Farben.
- Keine Änderung der Tastaturbedienung oder Haptik.
