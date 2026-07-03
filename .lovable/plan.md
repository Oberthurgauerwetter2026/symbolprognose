## Ziel

Alle Reste des Crossfade-Systems im Niederschlagsradar entfernen, sodass jeder Frame hart und ohne Überblendung dargestellt wird — wie vor der Einführung des Crossfades.

## Beobachtung

Im aktuellen Code (`src/components/maps/radar-map.tsx`) gibt es keine `ctx.globalAlpha`-Blends mehr in den Zeichenpfaden. Trotzdem sind die vollständigen Crossfade-Infrastrukturen weiterhin vorhanden und aktiv:

- `PrecipOverlay` empfängt weiterhin `nextFrame` und `progress` als Props und spiegelt sie in `nextFrameRef`/`progressRef`.
- Die Helfer-Funktion `buildBlendedOffscreenRef` (Zeilen ~909–1003) existiert weiterhin, inkl. `blendCanvasRef` und der pixelweisen Intensitäts-Interpolation zwischen zwei Frames — die ist der eigentliche "weiche" Übergang, den der Nutzer weiterhin sieht.
- `MeasurementCanvasOverlay` empfängt `nextFrame`/`progress` und decodiert per `useEffect([nextFrame?.precipUrl])` bereits das nächste PNG in `nextSourceRef`; `activeNextFrameRef`/`activeProgressRef` werden pro Tick aktualisiert.
- `RadarMap` gibt `overlayNext`/`overlayProg` weiterhin an beide Overlays weiter und `setTimelineTime` ruft `precipOverlayRef.setTimeline(frame, nextFrame, progress)` auf.

Das genügt, um weiterhin einen sichtbaren Übergang zwischen Nachbarframes zu erzeugen (Intensitäts-Interpolation im Grid-Pfad, doppelte Decodes und React-Re-Renders im Raster-Pfad, die je nach Timing wie ein Fade wirken).

## Änderungen — nur `src/components/maps/radar-map.tsx`

1. `PrecipOverlay`
   - Props `nextFrame` / `progress` entfernen (auch aus Typdefinition).
   - `useImperativeHandle setTimeline` auf Signatur `(f) => void` verkürzen — nur `frameRef` setzen und `redrawRef.current()` aufrufen.
   - Refs `nextFrameRef`, `progressRef`, `blendCanvasRef`, `lastTimelineKeyRef` (letzterer nur falls unbenutzt) entfernen.
   - Kompletten `buildBlendedOffscreenRef`-Block (~Zeilen 909–1003) inkl. aller Helfer entfernen.
   - Timeline-Sync-`useEffect` (`[nextFrame, progress]`) entfernen.

2. `MeasurementCanvasOverlay`
   - Props `nextFrame` / `progress` und Typdefinition entfernen.
   - `useImperativeHandle setTimeline` auf `(f) => void` verkürzen (aktuell wird `f` gar nicht genutzt; nur `redrawRef.current()`).
   - Refs `nextSourceRef`, `nextSourceUrlRef`, `activeNextFrameRef`, `activeProgressRef` entfernen.
   - Beide `useEffect`-Blöcke, die `nextFrame?.precipUrl` decodieren bzw. `nextFrame/progress` in Refs spiegeln, entfernen.
   - In `redrawRef.current` die noch dead-code `buildRasterOffscreen`-Aufrufe für `nextRaster`/`nextVals` sowie `buildGridOffscreen`/`sampleGridAt`/`contourScaleAt`-Helfer entfernen (werden nur für den Blend gebraucht).
   - Nutzung von `activeNextFrame?.source` in `sampleGridAt` entfällt mit.

3. `RadarMap`
   - In dem JSX-Block ab Zeile ~2682 die Übergabe `nextFrame`/`progress` an `PrecipOverlay` und `MeasurementCanvasOverlay` entfernen.
   - `overlayNext`/`overlayProg` werden nicht mehr benötigt; `timelineState.nextFrame`/`.progress` nicht mehr auslesen.
   - `TimelineOverlayHandle.setTimeline`-Signatur auf `(frame: RadarFrame | null) => void` reduzieren, ebenso den Aufrufer `setTimelineTime` (Zeile ~2438) → `precipOverlayRef.current?.setTimeline(timelineState.frame)`.

4. Alle verbliebenen Kommentare, die "Crossfade / Blend / Intensitäts-Interpolation" erwähnen, an die neue, harte Frame-Umschaltung anpassen.

Keine Änderung an `resolveTimelineState`, `timelineStateForMs`, Filmstrip, Autoplay-Loop, Scrubbing, Prewarm-Logik, oder anderen Karten (Satellit, Wind, Niederschlags-Akkumulation).

## Verifikation

- `bunx tsgo --noEmit` läuft grün.
- Im Preview `/karten/radar` während Autoplay: kein sichtbarer Übergang zwischen zwei Frames — jeder Frame erscheint hart. `document.querySelectorAll('canvas.radar-canvas')` bleibt bei einem Canvas mit konstanter `opacity: 0.6` und ohne pro-Tick-Blend.
- Scrubbing schaltet weiterhin snap-basiert auf den nächstliegenden Frame; Zeitachse und Filmstrip unverändert.
