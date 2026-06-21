# Satellitenbild schärfer machen (Meteociel-Niveau)

## Ziel
True-Colour-Animation über Schweiz/Alpen und Europa nutzt das **MTG-FCI HRFI**-Produkt (High Resolution Fast Imaging, ~1 km / 500 m) statt des 2-km-Full-Disc-Layers. Tiles werden als **PNG bei 512 px** ausgeliefert.

## Änderungen

### 1. `src/lib/satellite.functions.ts`
- `alpen-ch.layer` → `mtg_hrfi:rgb_truecolour` (Fallback bleibt `mtg_fd:rgb_truecolour`)
- `alpen-ch.stepMinutes` → **10 min** bleibt (HRFI liefert sogar alle 2,5–10 min)
- `europa-geocolour.layer` → `mtg_hrfi:rgb_geocolour` (Fallback `mtg_fd:rgb_geocolour`)
- `europa-ir.layer` → `mtg_hrfi:ir105` (Fallback `mtg_fd:ir105_hrfi`)
- `global-ir` unverändert (kein HRFI-Pendant)
- Quellen-Labels aktualisieren: „MTG-FCI HRFI True Colour" usw.

### 2. `src/components/maps/satellite-map.tsx` (`FrameStack`)
- WMS-Optionen: `tileSize: 512`, `format: "image/png"`, `transparent: false`
- Beim WMS-Request zusätzlich `WIDTH=512&HEIGHT=512` (Leaflet macht das via tileSize automatisch)
- **Fallback-Logik**: pro Layer ein `tileerror`-Handler — bei Fehler dynamisch auf `region.fallbackLayer` umschalten (einmaliger Reload des Frame-Stacks)
- `detectRetina` bleibt **aus** (sonst 4× Datenvolumen, Preload würde Animationsstart deutlich verzögern)

### 3. Was bleibt unverändert
- Animations-Pipeline (Frame-Preload, Opacity-Toggle, Speed-Select)
- Region-Auswahl, Zeit-Badge, Fullscreen
- `karten.satellit.tsx`, `embed.satellit.tsx`, `maps-config.ts`

## Trade-offs
- PNG 512 statt JPEG 256 → **~3–4× größere Tiles**, aber bei 5 h Window à 30 Frames × ~6 sichtbare Tiles ≈ 180 Requests, weiterhin im Sekundenbereich
- HRFI-Layer kann bei EUMETView gelegentlich 404/leer sein → Fallback auf Full-Disc-Variante automatisch

## Technische Details
EUMETView publiziert HRFI-Produkte unter dem Workspace `mtg_hrfi`. Die Layernamen folgen dem Schema des Full-Disc-Workspaces (`mtg_fd`), nur mit höherer nativer Auflösung der Quellbänder. Falls ein Layername bei EUMETView abweicht (z. B. `mtg_hrfi:rgb_truecolour_hrfi`), wird der `tileerror`-Handler den `fallbackLayer` aktivieren und die Karte zeigt weiterhin Bilder.
