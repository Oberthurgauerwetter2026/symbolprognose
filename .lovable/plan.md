# Radarmessung: Blitze mehr Glow, Kontrast, ohne Spiegelung

Ziel: Die Blitze im Niederschlagsradar-Messbereich sollen deutlicher aufleuchten (mehr Glow, mehr Kontrast) und nicht mehr gespiegelt werden.

## Ausgangslage (geprüft)

- `src/components/maps/lightning-bolt.ts` ist die zentrale Quelle für das Blitz-Symbol. Es definiert `BOLT_YELLOW`, `boltSvg(...)` und `boltJitter(...)`.
- `src/components/maps/radar-map.tsx` zeichnet Blitze via `boltJitter(s.lat, s.lon)` und übergibt `mirrored` an `boltSvg`.
- `src/components/maps/satellite-map.tsx` verwendet dieselben Funktionen und setzt das `mirrored` ebenfalls aus `boltJitter`.
- Die Radar-Legende zeigt bereits ein nicht gespiegeltes Blitz-Symbol (`boltSvg(12, 1, false, 0)`).

## Was geändert wird

### 1. `src/components/maps/lightning-bolt.ts`

- `boltSvg(...)` bekommt einen optionalen `glowBoost`-Faktor (Default 1). Der Faktor multipliziert die Drop-Shadow-Radien und die Opazität des breiten Glow-Strichs, ohne das Satellitenbild zu verändern.
- Neues Farbset `BOLT_RADAR` mit kräftigerem Gelb und mehr Kontrast: satterer Kern, leuchtender Glow.

### 2. `src/components/maps/radar-map.tsx`

- `RadarLightningLayer` verwendet `BOLT_RADAR` mit `glowBoost = 1.5`.
- Rotation (`tilt`) bleibt erhalten, aber `mirrored` wird immer `false` übergeben, damit keine Blitze horizontal gespiegelt werden.
- Der Legende-Eintrag "Blitze (Blitzortung)" verwendet ebenfalls `BOLT_RADAR` mit `glowBoost`, damit Legende und Karte übereinstimmen.

### 3. `src/components/maps/satellite-map.tsx`

- Keine Änderung. Blitze im Satellitenbild behalten aktuelles Verhalten: dezenteres Glow, Alterung (Gelb/Orange/Dunkelrot) und zufällige Spiegelung.

## Technisch

- Keine Änderung an Daten, Animation, `FLASH_FRACTION`, Zeitraster, Toggle-Button oder `localStorage`.
- Verifikation im Preview auf dem neuesten Radar-Messframe, ob Blitze heller/kontrastreicher und immer gleich orientiert erscheinen.
