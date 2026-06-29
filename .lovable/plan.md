## Änderungen

### 1) `src/components/maps/radar-map.tsx` — weniger Pixel-Look (Messung + Prognose)

- `cv.style.imageRendering = "pixelated"` (Z. 442) in `PrecipOverlay` auf `"auto"` setzen. Dieser CSS-Hint überschreibt aktuell jedes Canvas-Smoothing, deshalb wirkt das Bild trotz `imageSmoothingQuality = "high"` noch hart pixelig. `"auto"` lässt den Browser den finalen Skalierungs-Schritt glätten.
- `STEP` in `PrecipOverlay` (Z. 521): von `contour ? 2 : 1` auf `1` für beide Pfade. Damit wird das Offscreen-Raster in voller Anzeigeauflösung gebaut → spürbar feinere Kanten, ohne dass die Farbbänder verlaufen.

### 2) `src/components/maps/radar-map.tsx` — flüssige Bewegung in der Prognose-Animation

Heute schaltet die Prognose alle 1.8 s/Frame_Schritt hart auf das nächste 15-min-Bild. Profi-Radar-Viewer crossfaden zwischen den Frames. Wir nutzen die bereits vorhandene Interpolation aus dem Play-Loop:

- `PrecipOverlay` bekommt zwei neue, **optional** verwendete Props, die schon im Type vorhanden sind (`nextFrame`, `progress`).
- Im `redrawRef.current`-Pfad: nach dem `drawImage` des aktuellen `off` zusätzlich `nextOff` (aus dem gleichen `cacheRef`) mit `ctx.globalAlpha = progress` darüber zeichnen — nur wenn `nextFrame` gesetzt und beide Offscreens vorhanden sind. `nextFrame` rendert sich beim Pre-Warm sowieso schon ins `cacheRef`.
- `useEffect`-Trigger für `redrawRef` erweitern, sodass er bei Änderung von `progress`/`nextFrame` neu zeichnet. Throttling über `requestAnimationFrame` (Single-Flight via Ref) — kein State-Update pro Tick.
- Aufrufer (Z. 1941-1947): `nextFrame` und `progress` an `PrecipOverlay` übergeben. Quelle:
  - während Playback: aus dem bestehenden Tick — `nextFrame = frames[playStepIndices[playCursorRef.current + 1]]`, `progress = progressRef.current`. Dafür im Tick zusätzlich `setCrossfade({ nextFrame, progress })` (gethrottlet via RAF, kein zusätzlicher State pro Frame nötig — wir publizieren progress über ein Ref und triggern den Overlay per `redrawTick`-Counter).
  - im Pause/Scrub: `nextFrame = null`, `progress = 0` → hartes Bild wie heute, kein Crossfade.

Damit wandern Niederschlagsfelder zwischen zwei 15-min-Schritten kontinuierlich (Crossfade ≈ 1.8 s pro Schritt) — entlang der per Wind-Advektion verschobenen Felder ergibt das die typische „fliessende" Radar-Anmutung.

## Verifikation

- `bunx tsgo --noEmit` grün.
- `/karten/radar`: 
  - Messung wirkt deutlich weicher (keine harten Quadrate mehr, Farbbänder bleiben aber).
  - Im Play-Modus blendet die Prognose zwischen den 15-min-Frames sanft über; Sprünge nur noch an `:00`-Stundenwechseln (sind dort intendiert, weil sich das ICON-Basisfeld ändert).
  - Pause/Scrub zeigt weiterhin den exakten Frame ohne Crossfade.
