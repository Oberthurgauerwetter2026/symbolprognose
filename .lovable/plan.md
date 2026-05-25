## Hintergrund der Region-Karte an Radar angleichen

Beide Karten nutzen bereits dieselbe Swisstopo-Reliefkachel mit Opacity 0.55. Der sichtbare Unterschied liegt nur an den Grau-Masken, die in der Region-Karte deutlich kräftiger sind. Diese werden auf die Werte der Radar-Karte abgesenkt. Outlines (Region Oberthurgau, Kanton Thurgau, CH-Landesgrenze, See) bleiben unverändert.

### Änderungen in `src/components/region-map.tsx`

1. **Aussen-CH-Maske** (Z. 575–583):
   - `fillOpacity: 0.55` → `0.4` (wie Radar)

2. **Aussen-Maske Oberthurgau** (Z. 596–604):
   - `fillOpacity: 0.35` → `0.18` (wie Radar)

3. **Unverändert bleiben**:
   - Tile-Layer (`leichte-basiskarte_reliefschattierung`, opacity 0.55) — schon identisch
   - Hintergrundfarbe `#ebefeb` — schon identisch
   - Weisse CH-Landesgrenze
   - Kanton-Thurgau-Outline (`#1f4d80`, weight 2)
   - Region-Oberthurgau-Outline + Füllung (`BRAND`, weight 2, fill `#7ebd5a` opacity 0.28)
   - See (`#7ec8e3`, opacity 1)
   - Marker (SpotMarker)

### Effekt

Die Umgebung wird heller/transparenter und das Relief tritt stärker hervor — visuell wie auf der Radar-Karte. Die hervorgehobene Region und Thurgau bleiben klar erkennbar durch ihre Outlines.

Keine weiteren Dateien betroffen.