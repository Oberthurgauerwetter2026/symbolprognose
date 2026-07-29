## Ziel
Im Satellitenbild wird das Markenblau (`#2561a1`) überall durch ein gut sichtbares Gelb ersetzt — Länder-/Schweiz-Umriss, Region-Chips, Play-Button, Slider-Akzent und Fokusringe.

## Umsetzung
Datei: `src/components/maps/satellite-map.tsx`

1. Konstante `BRAND = "#2561a1"` → `ACCENT = "#facc15"` (kräftiges Gelb, hoher Kontrast auf Satellitenbildern bei Tag und Nacht). Umriss zusätzlich mit leichtem dunklem Halo/erhöhter Deckkraft, damit er über hellen Wolken sichtbar bleibt.
2. Alle Verwendungsstellen (Umriss-Farbe, aktiver Region-Chip, Play/Pause-Button, Fokusringe, Timeline-Akzent) auf die neue Konstante umstellen.
3. Lesbarkeit: Wo bisher weisser Text auf blauem Hintergrund stand (aktiver Chip, Play-Button), wird die Textfarbe auf dunkles Neutral umgestellt, da Weiss auf Gelb nicht lesbar ist.

Nur diese Ansicht wird geändert — Radar, Wind und Warnkarte behalten das Blau.

## Prüfung
Karte `/karten/satellit` per Browser-Screenshot in beiden Regionen (Schweiz & Alpen, Europa GeoColour) kontrollieren.
