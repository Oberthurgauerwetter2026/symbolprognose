# Blob-Rendering für Messung & Prognose

Umsetzung von Variante A + B (ohne Blur auf der Prognose-Canvas).

## Änderungen

### 1) `src/components/maps/radar-map.tsx`, Zeile 461

```ts
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";
ctx.drawImage(off, 0, 0, lowW, lowH, 0, 0, size.x, size.y);
```

Statt Nearest-Neighbor wird der low-res Buffer bilinear hochskaliert → runde, weiche Iso-Bänder bei der Prognose.

### 2) `src/styles.css`, `.mch-precip`

```css
.mch-precip {
  filter: blur(2.5px) saturate(1.05);
}
```

Leichter Blur verschmilzt die 1-km-Pixel der MCH-PNGs zu Blobs; `saturate(1.05)` kompensiert minimalen Kontrastverlust.

## Nicht geändert
- `SCALE` / `PRECIP_SCALE` / `colorFor` → Farbskala bleibt identisch zwischen Messung und Prognose.
- Animation, Smoothstep, STEP=2, `opacityVal = 1`.

## Dateien
- `src/components/maps/radar-map.tsx`
- `src/styles.css`
