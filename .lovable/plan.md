# Global IR aus Satellitenbild entfernen

## Ziel
Die Satellitenregion „Global Infrarot" (`global-ir`) soll aus dem Satellitenbild vollständig entfernt werden — sie ist aus der Region-Auswahl und dem Datenmodell nicht mehr verfügbar.

## Nachweis aus dem Code
- In `src/lib/satellite.functions.ts` ist der Typ `SatelliteRegionId` aktuell:
  ```ts
  "alpen-ch" | "alpen-ch-hd" | "europa-geocolour" | "europa-ir" | "global-ir";
  ```
- Die Region `global-ir` ist in `SATELLITE_REGIONS` (Zeilen 78–88) definiert:
  - Label: „Global Infrarot"
  - Layer: `mumi:worldcloudmap_ir108`
  - 3-stündliches Welt-Composite
- `totalHoursFor()` hat einen Sonderfall nur für `global-ir` (Zeile 114).
- Keine weiteren Referenzen auf `global-ir` im gesamten `src/`-Ordner (bestätigt durch `rg`).

## Änderungen
### `src/lib/satellite.functions.ts`
1. `SatelliteRegionId`-Union: `"global-ir"` entfernen.
2. `SATELLITE_REGIONS[]`: Eintrag `global-ir` entfernen.
3. `totalHoursFor()`: Spezialfall `region.id === "global-ir"` entfernen; Funktion retourniert dann einfach `3` für alle verbleibenden Regionen.

## Keine weiteren Änderungen
- Die UI-Region-Auswahl in `src/components/maps/satellite-map.tsx` iteriert bereits über `SATELLITE_REGIONS`, wodurch der Button automatisch verschwindet.
- Keine Backend-/API-Änderungen nötig; die Route `/karten/satellit` und der Server-Fn `getSatelliteManifest` bleiben unverändert.

## Validierung
- Nach der Änderung erscheint in der Satelliten-Region-Auswahl nur noch: „Schweiz & Alpen", „Europa Geo", „Europa IR".
- Typecheck wird durchgeführt, um sicherzustellen, dass keine versteckten `global-ir`-Referenzen verbleiben.