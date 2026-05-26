## Ziel

Identischer See-Look in Radar- und Region-Karte — eine einzige Farbe, eine einzige Transparenz, keine sichtbaren Tonunterschiede.

## Änderungen

### 1. `src/components/region-map.tsx` (Zeile ~617–626)

```tsx
<GeoJSON
  data={LAKE}
  style={() => ({
    color: "#7ec8e3",
    weight: 0.6,
    fillColor: "#7ec8e3",
    fillOpacity: 0.35,
  })}
  interactive={false}
/>
```

### 2. `src/components/maps/radar-map.tsx` (Zeile ~773–777)

Stroke-Farbe auf denselben Ton wie Fill setzen, damit beide Karten 1:1 identisch wirken:

```tsx
<GeoJSON
  data={LAKE}
  style={() => ({
    color: "#7ec8e3",
    weight: 0.6,
    fillColor: "#7ec8e3",
    fillOpacity: 0.35,
  })}
  interactive={false}
/>
```

## Was unverändert bleibt

- Lake-Geometrie, Reihenfolge der Layer, Outside-Masken, Region/Schweiz-Konturen.
- Niederschlags-Overlay scheint weiter durch den See.
- Region-Karte: Marker, Symbolprognose, Reliefschattierung.
