## Ziel

Basis-Tiles auf swisstopo **`ch.swisstopo.leichte-basiskarte_reliefschattierung`** wechseln (reines Relief ohne Beschriftungen/Strassen), Hintergrund `void` (neutral).

## Änderungen in `src/components/region-map.tsx`

- `pixelkarte-grau` TileLayer entfernen.
- Separate `swissalti3d-reliefschattierung` TileLayer entfernen.
- Einen einzigen TileLayer einsetzen:
  - URL: `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte_reliefschattierung/default/current/3857/{z}/{x}/{y}.png`
  - opacity `1`
- MapContainer-Hintergrund auf neutrales Hellgrau setzen (entspricht `void` bgLayer).
- Aussenmaske, Region (grün), See, Kanton-TG-Andeutung und Marker bleiben unverändert.
