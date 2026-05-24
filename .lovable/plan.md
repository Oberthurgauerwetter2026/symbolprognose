## Änderungen in `src/components/region-map.tsx`

Referenz-Farbton aus dem Screenshot: **`#ebefeb`** (sehr helles, leicht kühles Grau).

1. **Karten-Hintergrund (Schweiz-Bereich)**:
   - `background` des MapContainers → `#ebefeb`
   - Relief-TileLayer `opacity` → `0.55` (deutlich heller, Relief nur dezent sichtbar)

2. **Ausserhalb der Schweiz dunkler**:
   - Neue Datei `src/data/switzerland.json` — Landesgrenze CH (Layer `ch.swisstopo.swissboundaries3d-land-flaeche.fill` via `api3.geo.admin.ch`).
   - Neue Konstante `OUTSIDE_CH_MASK`: Welt-Polygon mit CH-Grenze als Loch.
   - Zusätzlicher `GeoJSON`-Layer **über** dem Relief (vor der bisherigen Aussenmaske) mit dunklem Ton (`#3a4148`, `fillOpacity 0.55`), wirkt nur ausserhalb CH.

3. **Bisherige Aussenmaske** (`#5a6670` / 0.6, See + Region ausgestanzt) bleibt — sie sorgt für den mittleren Grauton innerhalb CH ausserhalb Oberthurgau.

4. **Thurgau Outline** bleibt wie aktuell (`#1f4d80`, weight 2).

Layer-Reihenfolge:
1. Relief-Tiles
2. Aussen-CH-Maske (dunkel, nur ausserhalb CH)
3. Aussenmaske (mittleres Grau, See + Region ausgestanzt)
4. Kanton-TG-Outline
5. See
6. Region (grün)
7. Marker
