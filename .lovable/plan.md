
# Ortsgrenzen entfernen, nur Oberthurgau-Hülle + schwacher Thurgau

Ursache: `REGION_OUTLINE` in `wind-map.tsx` zeichnet **alle Ringe** der 21 Oberthurgau-Gemeinden in `region.json` → innenliegende Gemeindegrenzen erscheinen als blaue Linien. Auf der Radarkarte werden geteilte Kanten herausgerechnet, sodass nur der Aussenring der Region übrig bleibt.

## Änderungen in `src/components/maps/wind-map.tsx`

1. **REGION_OUTLINE-Berechnung wie Radar**: Die simple Variante (zeichnet alle Ringe) ersetzen durch denselben Edge-Dissolve-Algorithmus aus `radar-map.tsx` (Z. 183–257) — Kanten zählen, nur Kanten mit `count === 1` behalten, zu Polylinien verketten. Ergebnis ist der reine Aussenumriss der Region Oberthurgau.

2. **Thurgau-Kanton schwach zurück**: `THURGAU`-Import (`@/data/thurgau.json`) und Konstante wieder einfügen, GeoJSON-Layer vor `REGION_OUTLINE` rendern mit gleichem Stil wie Radar:
   ```ts
   { color: "#1f4d80", weight: 1, opacity: 0.45, fill: false }
   ```

## Was bleibt

- Wind-Datenlayer, Timeline, City-Marker, Settings-Popover unverändert.
- Ortschaften-Liste (Tier A/B/C) wie bereits angeglichen.
- Radarkarte unangetastet.
