# Messung klarer + transparenter

## 1) `src/styles.css`
```css
.mch-precip {
  filter: blur(1.8px) contrast(3.2) saturate(1.05);
}
```

## 2) `src/components/maps/radar-map.tsx` Z.955
```ts
const opacityVal = 0.65;
```
