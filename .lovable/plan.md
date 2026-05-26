Den See in beiden Karten vollständig deckend mit dem bestehenden helleren Blau `#7ec8e3` darstellen (keine Transparenz mehr).

## Änderungen

**1. `src/components/maps/radar-map.tsx`** (Zeile 777)
- `fillOpacity: 0.35` → `fillOpacity: 1`
- Farbe `#7ec8e3` und `weight: 0.6` bleiben.

**2. `src/components/region-map.tsx`** (Zeile 623)
- `fillOpacity: 0.35` → `fillOpacity: 1`
- Farbe `#7ec8e3` und `weight: 0.6` bleiben.

## Unverändert

See-Geometrie, Layer-Reihenfolge, Outside-Masken, Schweiz/Region-Konturen, Niederschlagsoverlay, Marker und Reliefschattierung. Auf dem Radar liegt die Niederschlags-Bildebene weiterhin über dem See, sodass Regenflächen über dem Wasser sichtbar bleiben.