## Ziel

Oberlinkes Badge (Quelle + Zeit) entfernen und Filmstrip-Bänder in der Messung grau, in der Prognose blau mit schwacher Deckkraft gestalten.

## Änderungen

### 1. Quellen-Badge oben links entfernen

In `src/components/maps/radar-map.tsx` den kompletten Block `{/* Quellen-Badge oben links */}` (inkl. `meta`-Badge und Zeit-Label) entfernen. Das betrifft nur die visuelle Anzeige, keine Logik.

### 2. Filmstrip-Bänder: Grün → Blau, Deckkraft reduzieren

- Messungs-Band: Farbe von `MEASUREMENT_COLOR` (#1f7a3a) auf `BRAND` (#2561a1) ändern.
- Prognose-Band: Beibehaltung von `BRAND` (#2561a1).
- Beide Bänder: Opacity von `0.9` auf `0.35` reduzieren.
- Die Bubble und der Dreieck-Pfeil über der Mittellinie bleiben wie bisher (grün/blau je nach Frame-Typ) — nur die unteren Streifen-Bänder werden geändert.

## Validierung

- Typecheck (`bunx tsgo --noEmit`) ausführen.
- Visuell prüfen, dass das Badge verschwunden ist und beide Filmstrip-Bänder blass-blau erscheinen.