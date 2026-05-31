# Metaball-Filter für scharfe Blob-Kanten

## Änderungen

### 1) `src/styles.css` — `.mch-precip`
```css
.mch-precip {
  filter: blur(3px) contrast(1.8) saturate(1.05);
}
```

### 2) `src/components/maps/radar-map.tsx`, Zeile 321
```ts
cv.style.filter = "blur(2.5px) contrast(1.7)";
```

## Wirkung
Blur verschmilzt Pixel zu organischen Blobs; hoher Contrast zieht die quantisierten Farbbänder wieder zu scharfen Kanten zusammen (Metaball-Effekt). Bilineare Canvas-Skalierung bleibt.

## Nicht geändert
Palette, SCALE, Animation, Opacity.
