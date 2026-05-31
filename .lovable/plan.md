# Messung: rundere Blob-Kanten

`src/styles.css`, `.mch-precip`:
```css
.mch-precip {
  filter: blur(2.8px) contrast(1.9) saturate(1.05);
}
```

Blur 1.5 → 2.8 px, Contrast 2.4 → 1.9. Pixel-Ecken verschmelzen zu runden Blobs; Bänder bleiben klar.
