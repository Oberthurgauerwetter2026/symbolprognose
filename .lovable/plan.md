## Problem

Die Pills verschwinden visuell auf der hellen Karte — zu wenig Kontrast zum OSM-Hintergrund. Zusätzlich kann `backdrop-filter` über animiertem Inhalt Performance kosten.

## Lösung

**Datei:** `src/components/region-map.tsx` — `MarkerPill`

- Hintergrund deckend: `rgba(255,255,255,0.92)`
- `backdropFilter` entfernen
- Rand: `1px solid rgba(15,23,42,0.12)`
- Schatten kräftiger für Abhebung: `0 6px 18px rgba(15,23,42,0.18), 0 2px 4px rgba(15,23,42,0.10)`
- Textfarben bleiben wie aktuell (dunkel)
