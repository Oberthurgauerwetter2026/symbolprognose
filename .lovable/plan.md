# Identische Palette + flüssigere Prognose-Animation

## Status

- RGB-Werte der MCH-PNG-Palette (`PRECIP_SCALE` in `scripts/ingest_radar.py`) und der Frontend-Skala (`SCALE` in `radar-map.tsx`) sind bereits **identisch**.
- Unterschied nur im Alpha: Messung 230/255 (≈0.902), Top-Band 242/255 (≈0.95). Prognose: konstant 0.92.
- Animation: `FRAME_MS = 600/speed`, `STEP = 1` (volle Pixelauflösung) → der bilineare Sample-Loop läuft pro rAF-Tick über ~1.4 Mio Pixel × 4 Nachbarsamples. Das limitiert die effektive Framerate auf ~20-30fps und wirkt ruckelig trotz `progress`-Lerp.

## 1. Palette exakt angleichen (`src/components/maps/radar-map.tsx`)

`SCALE` um Alpha-Feld erweitern, 1:1 wie in `PRECIP_SCALE`:

```ts
const SCALE: { mmh: number; rgb: [number,number,number]; a: number }[] = [
  { mmh: 0.1, rgb: [165,215,245], a: 230/255 },
  { mmh: 0.3, rgb: [90,165,230],  a: 230/255 },
  { mmh: 1,   rgb: [30,80,200],   a: 230/255 },
  { mmh: 3,   rgb: [40,170,70],   a: 230/255 },
  { mmh: 10,  rgb: [245,220,40],  a: 230/255 },
  { mmh: 30,  rgb: [240,140,30],  a: 230/255 },
  { mmh: 60,  rgb: [220,30,30],   a: 230/255 },
  { mmh: 100, rgb: [160,30,180],  a: 242/255 },
];
```

`colorFor()` nutzt `band.a` statt fix `0.92`. → Forecast-Bubbles haben exakt dieselbe Deckkraft pro Band wie die MCH-PNG-Messung.

## 2. Animation deutlich flüssiger

Bottleneck ist der CPU-Sample-Loop pro rAF. Zwei Hebel kombiniert:

**a) Sample-Schritt erhöhen** (`PrecipOverlay.redrawRef`):
- `STEP = 1` → `STEP = 2`. Off-screen-Buffer hat 1/4 der Pixel, `drawImage` skaliert linear auf volle Canvas-Grösse. Bilinear-Sampling am Daten-Grid ist eh die Glättung — der zusätzliche Upscale ist visuell kaum sichtbar (Bänder sind ohnehin breit), aber die Redraw-Zeit halbiert/viertelt sich → stabil 60fps möglich.

**b) Easing auf `progress`** (`RadarMap`-Play-Loop):
- Statt linear `np = p + dt/FRAME_MS` an `PrecipOverlay` weitergeben, einen smoothstep auf `progress` anwenden bevor er nach unten gereicht wird: `eased = progress*progress*(3-2*progress)`. Übergänge zwischen 15-min-Frames werden in der Mitte schneller, an den Enden weicher → wirkt fliessender ohne Frame-Tempo zu ändern.
- `FRAME_MS` bleibt bei `600/speed` (Tempo unverändert, nur Glättung verbessert).

## Nicht geändert

- `scripts/ingest_radar.py` (Palette schon korrekt).
- `colorFor`-Quantisierung, Bilinear-Sampling-Logik, Schnee-/Hagel-Layer.
- Frame-Geschwindigkeit / `speed`-Steuerung.

## Dateien

- `src/components/maps/radar-map.tsx` (Punkt 1 + 2a + 2b)
