## Umsetzung

`src/styles.css` → `.mch-precip` bekommt denselben Filter wie das Prognose-Canvas:

```css
.mch-precip {
  image-rendering: auto;
  filter: blur(0.8px) contrast(2.2);
  will-change: filter;
}
```

Keine weiteren Änderungen nötig — wirkt sofort auf alle bestehenden Mess-PNGs.