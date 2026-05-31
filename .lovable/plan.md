# Messung 0.1 schwächer + organische Prognose-Blobs

## 1) Messung 0.1 mm noch schwächer (Alpha 80 → 40)

- `src/components/maps/radar-map.tsx` Z.64: `a: 80/255` → `a: 40/255`
- `scripts/ingest_radar.py` Z.72: Alpha 80 → 40
- Version-Bump: `v15-mch-faint-01` → `v16-mch-faint-02`
  - `scripts/ingest_radar.py` Z.46
  - `.github/workflows/radar-ingest.yml` Z.21

## 2) Prognose: 9-Tap Gauss-Sampling statt 4-Tap bilinear

In `PrecipOverlay.redraw()` die `sample()`-Funktion (ab Z.416) durch 3×3 Gauss-Kernel ersetzen. Glättet Skalarfeld räumlich → runde Konturen statt Quadrate.

```ts
const GAUSS = [
  [1/16, 2/16, 1/16],
  [2/16, 4/16, 2/16],
  [1/16, 2/16, 1/16],
];
const sample = (arr: number[]) => {
  let acc = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const sx = x0 + dx;
      const sy = y0 + dy;
      const sx1 = sx + 1;
      const sy1 = sy + 1;
      const iX0 = sx >= 0 && sx < nLon;
      const iX1 = sx1 >= 0 && sx1 < nLon;
      const iY0 = sy >= 0 && sy < nLat;
      const iY1 = sy1 >= 0 && sy1 < nLat;
      const v00 = iX0 && iY0 ? arr[sy * nLon + sx] : 0;
      const v01 = iX1 && iY0 ? arr[sy * nLon + sx1] : 0;
      const v10 = iX0 && iY1 ? arr[sy1 * nLon + sx] : 0;
      const v11 = iX1 && iY1 ? arr[sy1 * nLon + sx1] : 0;
      const bil =
        v00 * (1 - tx) * (1 - ty) +
        v01 * tx * (1 - ty) +
        v10 * (1 - tx) * ty +
        v11 * tx * ty;
      acc += bil * GAUSS[dy + 1][dx + 1];
    }
  }
  return acc;
};
```

## 3) Canvas-Filter leicht reduzieren
- Z.321: `cv.style.filter = "blur(0.8px) contrast(2.2)"`

## Dateien
- `src/components/maps/radar-map.tsx`
- `scripts/ingest_radar.py`
- `.github/workflows/radar-ingest.yml`
