# Thurgau-Umriss im Radar dezent einzeichnen

## Änderung
**Datei:** `src/components/maps/radar-map.tsx`

1. Import ergänzen: `import thurgauData from "@/data/thurgau.json";`
2. Konstante: `const THURGAU = thurgauData as unknown as FeatureCollection;`
3. Im `MapContainer` zwischen der CH-Border-Linie (Z. 642–646) und `OUTSIDE_MASK` (Z. 647) einen neuen `<GeoJSON>`-Layer für Thurgau einfügen — dezent, nur Outline, keine Füllung:

```tsx
<GeoJSON
  data={THURGAU}
  style={() => ({ color: "#1f4d80", weight: 1, opacity: 0.45, fill: false })}
  interactive={false}
/>
```

Schwächer als in der Region-Map (dort weight 2 / opacity 0.85), damit Radar-Niederschlag im Vordergrund bleibt.

## Nicht verändert
Niederschlags-Overlay, Hagel, Masken, See, City-Marker, Slider.