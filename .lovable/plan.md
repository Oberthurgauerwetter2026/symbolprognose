## Ziel

Prognose-Frames (`icon-ch1` / `icon-ch2`) sollen optisch **exakt** wie die Messungs-PNGs aussehen: gleiche weiche, organische Blob-Ränder, kein Crossfade zwischen Frames, kein Denoise, keine künstlichen geometrischen Verzerrungen.

## Ursache

`src/components/maps/radar-map.tsx` behandelt Prognose-Paare (`isForecastPair`) heute mit einer eigenen Pipeline (Zeile ~1097–1215):

- `denoiseGrid(...)` — killt schwache Zellen, hinterlässt rechteckige Löcher/Kanten.
- Optical-Flow-Warp + Domain-Warp (`warpSample`, `edgeJitter`, `zSlot`) — fügt künstliche Bewegung/Fransen hinzu.
- Zeitliche Interpolation `oneMinusS * va + s * vb` — sichtbarer Crossfade zwischen A und B.
- `colorForSmooth(v)` statt `colorFor(v)` — weiche Bänder mit anderer Optik als die Messung.

Die Messung (`MeasurementCanvasOverlay`, Zeile ~1330 ff.) rendert dagegen: 3×3-Boxcar-Smoothing (`ensureSmooth`) → bilineares Sampling → **harte** `colorFor`-Bänder, kein Warp, kein Blend.

## Fix

In `src/components/maps/radar-map.tsx` die Forecast-Pipeline auf denselben Aufbau wie die Messung reduzieren:

1. `buildBlendedOffscreenRef` für Forecast-Paare so behandeln, dass nur der **aktuelle** Frame gerendert wird (kein A/B-Blend, kein Warp): entweder `s < 0.5 ? a : b` snappen oder direkt `buildOffscreenRef.current(currentFrame)` verwenden.
2. In `buildOffscreenRef.current` (Single-Frame-Path) und im verbleibenden Forecast-Zweig:
   - `denoiseGrid(...)`-Aufrufe entfernen.
   - `warpSample` / `edgeJitter` / `zSlot` / Flow-Warp für Forecast-Frames entfernen.
   - Statt `colorForSmooth` immer `colorFor` verwenden (identische Bänder wie Messung).
3. Vor dem Sampling ein 3×3-Boxcar-Smoothing analog `ensureSmooth` auf `values` (und `snowValues`) anwenden und pro Frame cachen — erzeugt die organischen Ränder ohne Denoise.
4. Ungenutzte Helper (`denoiseGrid`, `warpSample`, `edgeJitter`, `fbm2`, `valueNoise2`, `_valueNoise2Int`, `colorForSmooth`, `getFlowField`-Aufrufe im Forecast-Zweig, `_DENOISE_CACHE`) danach entfernen, um Tote-Code-Warnungen und weitere Verunreinigungen auszuschliessen.
5. Timeline-Progress im Forecast-Modus so lesen, dass beim Wechsel A→B einfach der Ziel-Frame gezeichnet wird (Snap, kein Fade).

## Scope

- Nur `src/components/maps/radar-map.tsx`.
- Keine Änderung an `radar.functions.ts`, an der Farbskala `SCALE`, an Timeline/Playback-UI oder an der Messungs-Pipeline (die bleibt Referenz).
