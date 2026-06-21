# Schweiz/Alpen-Satellit: Tag/Nacht wie Europa Geo

Die Region "Schweiz & Alpen" nutzt aktuell den True-Colour-Layer (`mtg_hrfi:rgb_truecolour`). Der ist nur tagsüber sichtbar — nachts schwarz. Europa Geo nutzt dagegen GeoColour, das ein Tag/Nacht-Composite liefert (nachts IR mit Lichtern, tagsüber farbig).

## Änderung

In `src/lib/satellite.functions.ts`, Eintrag `alpen-ch`:

- `layer`: `mtg_hrfi:rgb_truecolour` → `mtg_hrfi:rgb_geocolour`
- `fallbackLayer`: `mtg_fd:rgb_truecolour` → `mtg_fd:rgb_geocolour`
- `source`: "… True Colour" → "… GeoColour"
- `description`: "MTG FCI HRFI True Colour über Schweiz und Alpen (~1 km)" → "MTG FCI HRFI GeoColour über Schweiz und Alpen — Tag/Nacht (~1 km)"

Keine Änderungen an Step/Latency/Zoom — Layer-Familie und Cadence sind identisch zu Europa Geo.

## Verifikation

`/karten/satellit` öffnen, Region "Schweiz & Alpen" wählen, Animation abspielen. Frames bei Dunkelheit zeigen jetzt Wolken + Lichter statt schwarz.
