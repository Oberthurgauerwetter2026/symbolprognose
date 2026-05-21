## Änderungen in `src/components/region-map.tsx`

### 1. Hintergrundkarte → swisstopo Pixelkarte
Die aktuelle ArcGIS‑Hillshade‑Kachel ersetzen durch die öffentliche swisstopo WMTS (kein API‑Key, gratis nutzbar, Attribution swisstopo/OpenStreetMap):

```tsx
<TileLayer
  url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg"
  maxZoom={18}
  attribution="© swisstopo, © OpenStreetMap contributors"
/>
```

`attributionControl` auf `true` setzen (oder klein unten rechts einblenden), damit die Quellenangabe wie im Screenshot sichtbar ist.

Die graue Aussenmaske (`OUTSIDE_MASK`, `#8a96a0`, `opacity 0.7`) bleibt, damit ausserhalb der Region die Karte etwas zurücktritt — Hillshade fällt damit weg, aber der Effekt „Region hervorgehoben" bleibt durch die Maske erhalten.

### 2. Schieberegler‑Defaultwert je nach Tag
- **Heute (`dayIndex === 0`)**: Slider steht immer auf der aktuellen Zeit. Default + Reset bei Tageswechsel auf Heute: `hourStep = currentHourStep()`; `min = currentHourStep()`.
- **Andere Tage (`dayIndex > 0`)**: Slider steht immer auf Mitternacht. Bei Wechsel auf einen anderen Tag: `hourStep = 0`; `min = 0`.

Konkret:
- `useEffect([dayIndex])` setzt `hourStep` neu:
  - `dayIndex === 0` → `setHourStep(currentHourStep())`
  - sonst → `setHourStep(0)`
- Bisheriges „auf min hochziehen"‑Effect entfällt.
- `minHourStep` bleibt wie gehabt.

## Nicht geändert
- Bodensee‑Polygon, Marker, Bounds/Zoom, Tagesleiste/Slider‑Reihenfolge, Region‑Klick → `/`, Bodensee‑Label.

## Offene Punkte
- swisstopo‑Tiles sind nur innerhalb der Schweiz vollflächig — der deutsche/österreichische Bodenseeufer‑Bereich kann am Kartenrand leer/grau wirken. Da die Aussenmaske dort sowieso überdeckt, fällt das kaum auf.
- Falls du explizit den MapTiler‑Style aus dem Screenshot willst (statt swisstopo direkt), brauche ich einen MapTiler‑API‑Key — sag Bescheid, dann nehme ich `https://api.maptiler.com/maps/ch-swisstopo-lbm/{z}/{x}/{y}.png?key=…`.