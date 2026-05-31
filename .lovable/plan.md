# Klarere Bänder + leicht transparent für Relief-Sichtbarkeit

## Änderungen

### 1) `src/styles.css` — `.mch-precip`
```css
.mch-precip {
  filter: blur(1.5px) contrast(2.4) saturate(1.05);
}
```
Blur runter, Contrast hoch → scharfe Iso-Band-Kanten. Kein `opacity` hier (wird zentral in radar-map.tsx gesetzt).

### 2) `src/components/maps/radar-map.tsx`
- Zeile 321: `cv.style.filter = "blur(1.2px) contrast(2.2)";`
- Zeile 955: `const opacityVal = 0.78;` (statt `1`) — wirkt einheitlich auf Canvas und ImageOverlay, Reliefschattierung scheint durch.

## Nicht geändert
Palette, SCALE, Animation, bilineare Canvas-Skalierung.
