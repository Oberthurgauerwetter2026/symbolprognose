## Änderungen in `src/components/region-map.tsx`

1. **Hellerer Grauton im Karteninneren**: MapContainer-Hintergrund von `#e8edef` auf helleres `#f2f4f5` setzen, damit die Reliefkarte heller/leichter wirkt. Optional: Relief-TileLayer leicht transparent (`opacity 0.85`), damit der helle Untergrund durchscheint.
2. **Aussen-Maske unverändert** (`#5a6670`, opacity `0.6`) — bleibt wie gewünscht.
3. **Kanton Thurgau deutlicher**: Outline-Style anpassen — `weight: 2`, `opacity: 0.85`, `dashArray` entfernen (durchgezogene Linie), Farbe ggf. dunkler (`#1f4d80`) für besseren Kontrast. Weiterhin keine Füllung.
