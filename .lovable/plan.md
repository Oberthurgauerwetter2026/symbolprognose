
# Fix: EUMETView Layer-Namen korrigieren

Die Bilder erscheinen nicht, weil die WMS-Layer-Namen im Code falsch geraten sind. Ich habe die echten Namen aus dem Live-`GetCapabilities` von `view.eumetsat.int/geoserver/wms` geprüft.

## Korrekturen in `src/lib/satellite.functions.ts`

| Region          | Falsch (jetzt im Code)         | Korrekt (laut Capabilities)        |
|-----------------|---------------------------------|------------------------------------|
| Schweiz         | `mtg_fd:rgb_truecolor`          | `mtg_fd:rgb_truecolour`            |
| Alpen           | `mtg_fd:rgb_truecolor`          | `mtg_fd:rgb_truecolour`            |
| Europa GeoColour| `mtg_fd:rgb_geocolour`          | `mtg_fd:rgb_geocolour` (passt)     |
| Europa IR       | `mtg_fd:ir105`                  | `mtg_fd:ir105_hrfi`                |
| Global IR       | `mumi:wideareacoverage_ir`      | `mumi:worldcloudmap_ir108`         |

Fallbacks ebenfalls anpassen: `msg_fes:rgb_naturalenhncd` (existiert) und `msg_fes:ir108` (existiert).

## Zusätzliche Härtung

- WMS-Cache-Verlauf: EUMETView publiziert pro Layer eigene `TIME`-Dimension. Für MTG FCI sind 10 Min plausibel, für MSG 15 Min, für `worldcloudmap_ir108` (3-stündliches Welt-Mosaik) dagegen nur alle 3 Stunden ein neuer Frame. Ich passe in der Regions-Konfig die `stepMinutes`/`latencyMinutes` an:
  - `global-ir`: `stepMinutes: 180`, `latencyMinutes: 60` → ergibt 2 Frames in 5 h. Da der Nutzer 5 h Rückblick will, erweitere ich für `global-ir` auf 24 h, damit 8 Frames entstehen — sonst ist das eine sehr kurze Animation.
- `tileSize: 512`: einige EUMETView-Layer mögen kein 512er-Tiling. Auf `256` zurücksetzen.
- Falls ein WMS-Tile 404/500 liefert, fängt Leaflet das stillschweigend ab; Frame bleibt sichtbar.

## Was sich NICHT ändert

- Keine neuen Dateien, kein Ingest, kein Key — nur Strings in `satellite.functions.ts` und das `tileSize`-Feld in `satellite-map.tsx`.

Nach den Edits sollten die Bilder beim Reload sofort erscheinen.
