Filmstrip beim Ziehen visuell hervorheben

## Ziel
Der Filmstrip soll dem Benutzer eindeutig signalisieren, während er aktiv mit dem Finger oder der Maus bewegt wird. Das Feedback muss auf Touch und Desktop gleich gut funktionieren und darf das restliche Layout nicht verschieben.

## Änderung
- Datei: `src/components/maps/filmstrip-timeline.tsx`
- Betroffene Komponente: `FilmstripTimeline`

Konkrete Anpassungen:
  - Während des Ziehens (`dragging === true`) erhält der Filmstrip eine deutlichere visuelle Hervorhebung:
    - Stärkerer farbiger Schatten/Rahmen (z. B. `shadow-lg` + `ring-2`) in der aktuellen Kartenfarbe (`color`).
    - Leicht erhöhte Opazität oder hellerer Hintergrund, um den aktiven Zustand zu betonen.
    - Cursor bleibt `cursor-grabbing`, wird aber nicht verändert (bereits vorhanden).
  - Zentrale Mittellinie und Dreieckspitze während des Ziehens leicht hervorgehoben, z. B. durch grössere Höhe/Breite oder stärkere Kontrastfarbe.
  - Beim Loslassen fließt die Hervorhebung zurück in den Ruhezustand (Transition 200 ms).

## Nicht im Scope
- Keine Änderung der Scroll-/Momentum-Logik.
- Keine Änderung der Zeitformatierung, der Blasengrösse oder der Farben.
