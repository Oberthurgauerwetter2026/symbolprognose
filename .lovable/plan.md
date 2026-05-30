## Ziel

Auf `/karten/radar`:
1. Standard-Zoom näher heran (ein Zwischenzoom).
2. Oberthurgau-Umriss in Blau, **nur Aussengrenze**, nicht jede Teilfläche.
3. Bandkanten in den Prognose-Niederschlägen noch etwas schärfer.

## Änderungen in `src/components/maps/radar-map.tsx`

### 1. Standard-Zoom

`<MapContainer ... zoom={9}>` → `zoom={10}`. Center bleibt `[47.575, 9.35]`. `minZoom={8}` bleibt.

### 2. Oberthurgau-Umriss als Aussenring (blau)

Aktuell zeichnet `<GeoJSON data={REGION}>` jedes Polygon aus `src/data/region.json` einzeln → man sieht jede Binnenkante.

Neu: einmal beim Modul-Laden die Polygone zu einem Aussenring vereinen und nur diesen zeichnen.

Umsetzung ohne neue Dependency (Kanten­zählung):
- Hilfsfunktion `buildOuterOutline(fc: FeatureCollection): FeatureCollection` neben dem bestehenden `collect(REGION)`-Block.
- Über alle Polygon-Ringe iterieren, jedes Segment `(A,B)` mit Koordinaten auf 6 Nachkommastellen normalisieren, in einer `Map<string, count>` zählen (Schlüssel sortiert, sodass `(A,B)` und `(B,A)` gleich sind).
- Segmente mit `count === 1` sind Aussenkanten, Segmente mit `count >= 2` sind innere Gemeindegrenzen und werden verworfen.
- Aussenkanten zu Ringen ketten (Adjazenz-Map über Endpunkte) und als ein `MultiLineString`-Feature ausgeben.
- Resultat in Konstante `REGION_OUTLINE` cachen.

Im JSX: `<GeoJSON data={REGION}>` → `<GeoJSON data={REGION_OUTLINE}>` mit Style:
```ts
{ color: "#1f4d80", weight: 2, opacity: 0.9, fill: false }
```
(blau, klar erkennbar). `interactive={false}` bleibt.

### 3. Schärfere Bandkanten in der Prognose

Im Bilinear-Sampling der Forecast-Grid-Schleife (aktuell um Zeile 320–343): `tx` und `ty` durch eine logistische S-Kurve schärfen, bevor sie in die Gewichte gehen. Quantisierung der Farbe (`colorFor`) bleibt, die SCALE-Schwellen bleiben. Effekt: die Übergangszone zwischen zwei Grid-Zellen wird schmaler → Iso-Bänder bekommen klarere Ränder, ohne pixelig zu werden.

Konkret:
```ts
const SHARP = 7; // Steilheit
const sharpen = (u: number) =>
  1 / (1 + Math.exp(-SHARP * (u - 0.5)));
const txs = sharpen(tx);
const tys = sharpen(ty);
// dann v00*(1-txs)*(1-tys) + v01*txs*(1-tys) + v10*(1-txs)*tys + v11*txs*tys
```

`ctx.imageSmoothingEnabled = false` bleibt, CSS-Filter `saturate(1.3) contrast(1.2)` bleibt. Messung (PNG-Pfad) ist davon nicht betroffen.

## Nicht betroffen

Farbskala / SCALE, Messung (PNG), Cache, Ingest, Timeline, Steuerung, Hagel, Schnee-Logik, andere Karten, `THURGAU`-Layer, `SWITZERLAND`-Layer, Masken, See, Basemap, `ZoomGate`/Ortslabels (Schwelle 10.5 bleibt).

## Validierung auf `/karten/radar`

- Beim Öffnen: Karte ist eine Stufe näher (Zoom 10).
- Oberthurgau zeigt nur eine durchgehende **blaue** Aussengrenze, keine Binnenlinien.
- Prognose-Frame (z. B. +30 min, +1 h): Bänder haben sichtbar klarere Ränder als zuvor, Innenflächen bleiben sauber gefärbt, kein Pixel-Look.
