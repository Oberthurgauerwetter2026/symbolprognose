# Blitze: dünne schwarze Kontur

Ziel: Die Blitz-Symbole im Niederschlagsradar und im Satellitenbild erhalten eine dünne, schwarze Umrisslinie, damit sie sich vom Hintergrund besser abheben.

## Ausgangslage (geprüft)

- `src/components/maps/lightning-bolt.ts` zentralisiert das Blitz-Symbol (`BOLT_PATH`, `boltSvg`, `BOLT_YELLOW`, `BOLT_RADAR`).
- `src/components/maps/radar-map.tsx` zeichnet Blitze mit `BOLT_RADAR` und `glowBoost = 1.5`.
- `src/components/maps/satellite-map.tsx` zeichnet Blitze mit `BOLT_YELLOW` (alterungsabhängig).
- Beide Legenden-Einträge rufen `boltSvg(...)` direkt auf.

## Was geändert wird

### 1. `src/components/maps/lightning-bolt.ts`

- `BoltColors` um einen neuen Farbwert erweitern:
  - `outline: string` – Farbe der Umrisslinie (Default: `rgba(0,0,0,0.85)`).
  - Optional: `outlineWidth: number` in Pixeln, damit Radar/Satellit unterschiedliche Konturstärken nutzen können (Default: `1.0`).
- `BOLT_YELLOW` und `BOLT_RADAR` bekommen beide `outline: "rgba(0,0,0,0.85)"` und `outlineWidth: 1`.
- `boltSvg(...)` rendert zusätzlich einen Hintergrund-Pfad mit der schwarzen Outline:
  - Reihenfolge: Outline-Pfad → Glow-Stroke-Pfad → Kern-Pfad.
  - Outline-Pfad: derselbe `BOLT_PATH`, gefüllt mit der Glow-Farbe (oder transparent), mit `stroke="${colors.outline}"` und `stroke-width="${colors.outlineWidth}"`, geringfügig breiter als der aktuelle Kern-Kontur (`edge`), damit der schwarze Rand sichtbar ist.
  - Stil: `stroke-linejoin="round"`, `stroke-linecap="round"`, Opazität wie der Hauptpfad.

### 2. Radar- und Satellitenkarte

- Keine Code-Änderung nötig, da beide `boltSvg` mit `BOLT_RADAR`/`BOLT_YELLOW` aufrufen. Neue Kontur wird automatisch übernommen.

### 3. Legenden

- Keine Änderung nötig; `boltSvg(...)` wird direkt verwendet und zeigt die Outline mit an.

## Technisch

- Keine Änderung an Daten, Animation, `FLASH_FRACTION`, Zeitraster, Toggle-Button oder `localStorage`.
- Keine Änderung an Satelliten-Alterungsfarben oder Radar-Glow-Boost.
- Verifikation im Preview: Blitz-Symbole in Radar und Satellitenbild zeigen eine dünne schwarze Linie, ohne dass der Glow flackert oder verschmiert.
