## Änderung

Den sichtbaren Namen der Radar-Karte von "Radar" auf "Niederschlagsradar" ändern.

## Betroffene Stellen

1. **`src/lib/maps-config.ts`** — `label` und `shortLabel` des `radar`-Eintrags:
   - `label`: "Radar" → "Niederschlagsradar"
   - `shortLabel`: "Radar" → "Niederschlagsradar" (für MapTabs)

2. **`src/routes/karten.radar.tsx`** — Seiten-Titel:
   - "Radar Oberthurgau · Niederschlags-Animation" → "Niederschlagsradar Oberthurgau · Niederschlags-Animation"

## Keine Änderung an
- Route-URLs (`/karten/radar`, `/embed/radar`)
- Internen IDs (`id: "radar"`)
- Dateinamen oder Funktionsnamen
- Embed-Info-Seite (bezieht Labels dynamisch aus `maps-config.ts`)