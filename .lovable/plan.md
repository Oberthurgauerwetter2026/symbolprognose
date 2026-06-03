## Änderung
In `src/components/maps/precip-accum-map.tsx` in `cityIcon()` das blaue Quadrat durch einen Punkt ersetzen — identisch zum Radar-Karten-Stil (`•`, 14px, Farbe `#2561a1`, weisser Text-Shadow).

Konkret: das `<span style="${square}"></span>` wird zu `<span style="${bullet}">•</span>` mit den Bullet-Styles aus `radar-map.tsx`.

Zoom-Logik und Ortsliste bleiben unverändert.
