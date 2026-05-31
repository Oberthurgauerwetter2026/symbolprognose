# 0.1 mm-Band sehr schwach

## Änderungen

### 1) `src/components/maps/radar-map.tsx`, Zeile 64
```ts
{ mmh: 0.1, rgb: [165, 215, 245], a: 80 / 255 },
```
(Alpha 230/255 → 80/255 ≈ 31%)

### 2) `scripts/ingest_radar.py`, Zeile 72
```python
(0.1, (165, 215, 245, 80)),
```

### 3) Version-Bump
- `scripts/ingest_radar.py`, Zeile 46: `RADAR_INGEST_VERSION = "v15-mch-faint-01"`
- `.github/workflows/radar-ingest.yml`, Zeile 21: `EXPECTED_RADAR_INGEST_VERSION: "v15-mch-faint-01"`

Damit der Ingest-Versions-Check im Workflow passt und gecachte R2-PNGs durch die Versions-Migration ersetzt werden.

## Wirkung
- Prognose-Canvas: sofort.
- Messung-PNG: ab nächstem Ingest-Lauf (5-min-Cron).

## Nicht angefasst
0.3 / 1 / 3 / 10 / 30 / 60 / 100 mm-Bänder.
