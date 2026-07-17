## Ziel

Bestätigen: Die Satellit-Ansicht bleibt bei **MTG-FCI HRFI GeoColour** (Meteosat-12 / 3. Generation, EUMETView-WMS). Keine Angleichung an sat24.

## Umsetzung

Keine Änderungen nötig — die aktuelle Konfiguration in `src/lib/satellite.functions.ts` verwendet bereits:

- `alpen-ch` und `europa-geocolour`: `mtg_hrfi:rgb_geocolour` (Fallback `mtg_fd:rgb_geocolour`)
- `europa-ir`: `mtg_hrfi:ir105`
- `global-ir`: `mumi:worldcloudmap_ir108`

Die im vorherigen Turn geplante Entfernung von „Schweiz HD" bleibt bestehen.

## Verifikation

Keine — reine Bestätigung des Status quo.