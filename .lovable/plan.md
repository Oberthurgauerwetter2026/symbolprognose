## Ziel

Prognose-Rendering in `src/components/maps/radar-map.tsx` so anpassen, dass:
- die isolierten Streu-Pixel („Verunreinigungen") verschwinden,
- keine erkennbaren geometrischen Formen (Kapseln/Würste/Quadrate) mehr sichtbar sind,
- keine Crossfades / Optical-Flow-Blends mehr aktiv sind (harter Frame-Wechsel wie Messung),
- die Zellen weich, wolkenartig, ohne Ringmuster gerendert werden.

Nur Frontend, nur `radar-map.tsx`. Backend, Skala, Legende, Timeline, Ingest bleiben unberührt.

## Ursachenanalyse

- **„Kapseln / Würste"** entstehen weil `colorFor(v)` harte Farbbänder quantisiert. Bilineare Interpolation auf dem groben ~7 km ICON-CH1-Grid erzeugt glatte Gradienten, die durch die harten Bänder als konzentrische Ovale sichtbar werden. Das ist der Effekt, den der Nutzer als „geometrische Formen" wahrnimmt.
- **„Verunreinigungen"** = einzelne aktive Grid-Punkte ohne Nachbarn, die nach dem Upsampling als isolierte Flecken auftauchen. Aktuell wird `denoiseGrid` in den Prognose-Renderpfaden gar nicht mehr aufgerufen (`vals = rawVals`).
- **Crossfade** ist zwar visuell aus (`buildBlendedOffscreenRef` wird nicht mehr aufgerufen), der tote Code steht aber noch drin und stiftet Verwirrung.

## Änderungen (nur `src/components/maps/radar-map.tsx`)

1. **Prognose-Farbgebung weich statt hart quantisiert.**
   In beiden Prognose-Renderpfaden (`redrawRef.current` ab Zeile 820 und `buildOffscreenRef.current` ab Zeile 992) für `frame.source !== "radar"`:
   - Statt `colorFor(v)` → `colorForSmooth(v)` verwenden.
   - Nur Regen — Schnee und Messung bleiben unverändert (`colorFor` / `snowColorFor`).
   - Zusätzlich weiche Rand-Alpha: unterhalb ~0.3 mm/h Alpha linear gegen 0 ausblenden (fransiger, wolkenartiger Rand ohne Iso-Konturen).

2. **Denoise für Prognose wieder aktivieren, in stärkerer Form.**
   Vor dem Render-Loop, wenn `isForecastFrame`:
   - `vals = denoiseGrid(rawVals, nLon, nLat, 0.1, 3)` (min. 3 Nachbarn > 0.1 mm/h) → entfernt isolierte 1-Pixel-Echos.
   - Zusätzliche Connected-Component-Filterung: Zellen, deren zusammenhängender Cluster < 4 Grid-Punkte hat, werden auf 0 gesetzt. Kleine Helferfunktion `dropSmallClusters(vals, nLon, nLat, 0.1, 4)` neu in Datei einfügen (BFS auf 4er-Nachbarschaft, cached per `WeakMap` wie `_DENOISE_CACHE`).
   - Snow-Grid wird über dieselbe Maske reduziert (auf 0 gesetzt, wenn zugehöriger Regen 0 wurde), damit keine Schnee-Streupixel übrig bleiben.

3. **Crossfade-/Optical-Flow-Code entfernen.**
   - `buildBlendedOffscreenRef`, `blendCanvasRef`, `getFlowField`, `FLOW_CACHE`, `sampleBilinear` und die Prop `nextFrame` / `progress` aus `PrecipOverlay` + Aufrufer entfernen.
   - `nextFrameRef` / `progressRef` löschen.
   - `colorForSmooth` bleibt (wird jetzt in Punkt 1 verwendet).
   - Kommentar bei Zeile 977 durch Sauber-Zustand ersetzen.

4. **Domain-Warp-/Noise-Helfer entfernen** (`fbm2`, `valueNoise2`, `_valueNoise2Int`, `_hash3i`, `warpSample`, `edgeJitter`), da nirgends mehr referenziert. Reduziert Verwechslungsgefahr und Dead Code.

5. **Aufrufer in der Datei** (`<PrecipOverlay …>`, ~Zeile 2355) auf neue Prop-Signatur ohne `nextFrame`/`progress` anpassen. `prewarmFrames` bleibt.

## Erwartetes Ergebnis

- Prognose-Zellen: weiche, wolkenartige Verläufe ohne konzentrische Ringe / Kapselformen.
- Keine einzelnen Streu-Pixel mehr (Cluster < 4 werden entfernt).
- Frame-Wechsel hart wie in der Messung, ohne Crossfade oder simulierte Bewegung.
- Messung-Renderpfad und -PNG bleiben bit-identisch.

## Nicht-Ziele

- Keine Änderung an Backend, `radar.functions.ts`, R2-Ingest, Farbskala, Legende, Timeline, Snow/Hail-Overlays, Measurement-Overlay.
- Keine künstliche Bewegung / Nowcast-Advektion.
