# Filmstrip wieder wie auf dem Bild

## Was sich ändert
- Die vollen Stunden bekommen wieder einen feinen dunklen Strich, wie auf deinem Bild. Die breite weisse Stundenlinie fällt weg.
- Zwischen den Stunden kommen wieder regelmässige weisse Striche, alle 10 Minuten. Das gilt auch im Prognoseteil, wo nur jede volle Stunde ein Bild hat.
- Das farbige Band reicht wieder bis zum unteren Rand, wie auf dem Bild.
- Gilt für Radar, Satellit und Wind. Danach prüfe ich es in Handygrösse.

## Technische Details
- `src/components/maps/filmstrip-timeline.tsx`:
  - `ticks10` werden wieder in einem festen 10-Minuten-Raster zwischen `tMin` und `tMax` berechnet statt aus den Frame-Zeiten (volle Stunden ausgenommen), alle `bg-white/75`.
  - Stunden-Strich: `w-px bg-neutral-900/40` über die Bandhöhe, ohne Schatten und ohne `z-10`.
  - Bänder: von `top-6 h-4` auf die frühere Höhe, die bis unten reicht (`top-6 bottom-0`), Ticks darin vertikal angepasst.
