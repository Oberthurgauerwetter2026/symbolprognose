Änderung in `src/components/maps/satellite-map.tsx`:

- `SwissOutline` Komponente: GeoJSON-Stil `color` von `#ffffff` auf ein gelb (z. B. `#facc15` Tailwind yellow-400) umstellen, damit der Schweiz-Umriss im Satellitenbild gelb statt weiss dargestellt wird.

```text
Vorher:
color: "#ffffff"

Nachher:
color: "#facc15"
```

Keine weiteren Dateien oder Logik betroffen.