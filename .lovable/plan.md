## Ziel
Manuelles Scrubbing in `radar-map.tsx` läuft butterweich — Frame schaltet bei jeder Cursor-Position ohne Mikro-Stocker, ohne Crossfade, ohne Weichzeichnung. Prognose-Frames bleiben strikt im 15-min-Takt (wie vom Backend nach Advektion geliefert).

## Ursache der aktuellen Ruckler

1. **Lazy Canvas-Render im `PrecipOverlay`**: Jeder Prognose-Frame (Grid-basiert, kein PNG) wird *beim ersten Anzeigen* gerendert (bilineare Sampling + Farbband-Mapping auf `lowW×lowH` Pixeln). Erst danach landet er im `cacheRef`. Beim Scrubben über 96 Forecast-Frames stockt jeder noch nie besuchte Frame kurz.
2. **Cache zu klein**: `CACHE_MAX = 64`, aber die Timeline hat ~30 Messung + ~96 Prognose-15-min + ~24 Prognose-stündlich = ~150 Frames. Während Scrub fliegen ältere Frames raus → erneutes Re-Rendern.
3. **Kein Pre-Warm**: Der bestehende `useEffect` lädt nur PNG-URLs vor (Messung). Forecast-Frames haben kein PNG, der Canvas-Cache bleibt kalt.

15-min-Takt selbst stimmt bereits — `playStepIndices` bucketed Forecast in 15-min-Slots, Advektion im Backend liefert pro Slot ein eigenes Feld. Das ist nicht das Problem.

## Änderungen (nur `src/components/maps/radar-map.tsx`, keine Backend-Änderung)

### 1. Cache vergrössern
- `CACHE_MAX` in `PrecipOverlay` von `64` auf `256`, damit die komplette Cadence-Timeline reinpasst und Scrubbing nie evicted.

### 2. Pre-Warm der Forecast-Canvas nach Map-Idle
- Im `PrecipOverlay` zusätzlich eine Pre-Warm-Routine:
  - Trigger: nach `map.whenReady()` + jedes `moveend`/`zoomend` (debounce ~200 ms), sobald der `lookupRef` für die aktuelle View fertig ist.
  - Iteriere über alle Frames der aktuellen Cadence-Liste (über ein neues optionales Prop `prewarmFrames: RadarFrame[]` von `RadarMap` reingereicht — `stripFrames`).
  - Pro Frame: identische Render-Schleife wie heute, aber ohne `drawImage` auf die sichtbare Canvas — nur in `cacheRef` legen.
  - Chunked via `requestIdleCallback` (Fallback `setTimeout 0`), maximal ein Frame pro Idle-Tick, abbrechbar bei View-Wechsel.
- Effekt: Sobald die Karte ruht, sind alle Frame-Canvas vorberechnet. Scrub und Play schalten via `drawImage` aus Cache — instant.

### 3. Bestätigung: kein Crossfade, kein Smoothing
- `PrecipOverlay` redraw läuft nur auf `[frame, payload]` — bleibt so. Kein `progress`/`nextFrame`-Mixing.
- `FilmstripTimeline.onMove` snappt bereits per `snapAndEmit` auf den nächstgelegenen Cadence-Frame (15 min in Prognose, 5 min in Messung). Bleibt unverändert.
- `playVisualMs` treibt nur Bubble/Marker kontinuierlich; das Radarbild bleibt frame-genau.

### 4. Kleinkram
- `MeasurementCanvasOverlay` (PNG-basiert) ist nicht betroffen — PNG-Preload bleibt.

## Verifikation

- `/karten/radar`: Karte laden, kurz warten (1–2 s Idle), Filmstrip durchscrubben. Prognose-Frames erscheinen ohne sichtbares Stocken, in sauberen 15-min-Schritten, mit räumlich verschobenen NS-Feldern (Advektion).
- Beim Pan/Zoom wird Cache invalidert, Pre-Warm läuft sofort wieder.
- Play unverändert: harte 15-min-Sprünge, keine Crossblende.
- Console-Logs zeigen keine zusätzlichen Netzwerk-Requests pro Scrub.
