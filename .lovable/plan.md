# Region-Füllfarbe: Grün → Helles Grau

## Ziel
In der Symbolprognose-Karte (`RegionMap`) die grüne Region-Füllung (`#7ebd5a`) durch ein helles Grau ersetzen, das zum Radar-Map-Stil passt.

## Änderung
**Datei:** `src/components/region-map.tsx` (Zeile 634)

- `fillColor: "#7ebd5a"` → `fillColor: "#c4cdd4"` (helles, dezentes Kaltgrau)
- `fillOpacity: 0.28` → `fillOpacity: 0.35` (leicht erhöht, damit die Fläche bei hellem Grau weiterhin gut sichtbar bleibt)

## Nicht verändert
- Region-Outline (`color: BRAND` / `#2561a1`, weight 2)
- Alle Masken (OUTSIDE_CH_MASK, OUTSIDE_MASK — bereits an Radar angeglichen)
- See-Farbe, Thurgau-Outline, Marker, Slider, Tabs