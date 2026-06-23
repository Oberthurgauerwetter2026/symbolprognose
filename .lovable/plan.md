## Ziel
Manuelles Scrubbing auf Desktop soll flüssig laufen – ohne dass die per-Frame-Optik geglättet/verändert wird.

## Ursache
Bei jedem Scrub-Schritt (idx-Wechsel) wird das gesamte Overlay neu berechnet:

- `PrecipOverlay` (radar-map.tsx, redrawRef): bei Forecast STEP=1 → pro Pixel bilineares Sampling + 5-Oktaven fBm (Warp + Envelope + Edge-Mask). Auf einem grossen Desktop-Canvas (≈ 1.7 Mio Pixel) sind das zig Millisekunden pro Frame. Slider schickt rAF-getaktet neue idx → jeder Commit löst einen kompletten Repaint aus.
- `WindColorOverlay` (wind-map.tsx, redrawRef): pro Pixel `containerPointToLatLng` + `sampler.gust` (bilinear). Ebenfalls full-repaint pro Frame-Wechsel.

Slider/Throttling ist bereits ok (rAF + lastSentIdxRef). Engpass ist der Repaint selbst.

## Lösung: Frame-Canvas-Cache (keine Glättung)

Pro Frame wird das fertig kolorierte Low-Res-Bild einmal in einen Offscreen-`HTMLCanvasElement` gerendert und in einer LRU-Map gecacht. Beim Scrub/Play wird nur noch `drawImage(cachedCanvas)` aufgerufen → Repaint-Kosten gehen von ~30–80 ms auf <1 ms.

Wichtig: An der Optik ändert sich nichts – gleicher fBm/Warp/Envelope-Code, gleiche STEP-Werte, gleiche Farb-Bänder, kein Crossfade, kein Lerp.

### 1) Radar `PrecipOverlay` (src/components/maps/radar-map.tsx, ~Z. 320-593)

- Cache-Key: `${frame.t}|${viewKey}` mit `viewKey = ${zoom}|${size.x}x${size.y}|${dpr}|${centerLat.toFixed(4)}|${centerLng.toFixed(4)}`. Karte verschoben/gezoomt → neuer Key → Neuberechnung.
- LRU `Map<string, HTMLCanvasElement>` (Komponent-Ref), Limit z. B. 64 Frames; älteste Einträge raus.
- Bei `move/zoom/resize` (Leaflet-Event) Cache leeren (alle Einträge betreffen alte View).
- `redrawRef.current()` Ablauf:
  1. View-Canvas (`cv`) wie bisher resizen + positionieren + clear.
  2. Cache-Lookup. Hit → `ctx.drawImage(cached, 0, 0, size.x, size.y)` (mit dpr-scale wie heute), fertig.
  3. Miss → bestehende Pixel-Schleife in den Offscreen-Canvas rendern (identischer Code, identische Parameter), in Cache legen, dann blitten.
- Effekt-Dep bleibt `[frame, payload]`. Opacity weiterhin via `cv.style.opacity` (kein Repaint nötig).
- `MeasurementHailDotsLayer`: gleiche Strategie nur falls Profiling zeigt, dass es relevant ist – sonst unverändert.

### 2) Wind `WindColorOverlay` (src/components/maps/wind-map.tsx, ~Z. 372-491)

Analog: LRU `Map<string, HTMLCanvasElement>`, Key `${frame.t}|${viewKey}`, Invalidierung bei `moveend/zoomend/resize`. Redraw-Dep bleibt `[frame, opacity, payload]`. Optik unverändert (STEP=1, identische `windColor`, identischer Sampler).

### 3) Was NICHT geändert wird

- Keine zusätzliche Glättung/Easing/Crossfade zwischen Frames.
- Keine Reduktion der fBm-Oktaven, kein STEP-Wechsel, keine Auflösungsreduktion während Scrub.
- Keine Änderung am Slider-Verhalten, an Step-Cadence (5 min/15 min/1 h) oder am Play-Loop.
- Keine Änderung an Partikeln, Isobanden-Farben, Hagel-Punkten, Marker.

## Verifikation

- `bun run typecheck` (bzw. tsgo).
- Playwright auf `/karten/radar`: Slider von links nach rechts ziehen, Screenshots an mehreren idx prüfen → identisches Bild zum aktuellen Zustand pro Frame.
- Console: keine neuen Warnungen, keine Memory-Spitzen (LRU greift).
- Sichtkontrolle Desktop (1737×1241): Scrub fühlt sich flüssig an, Frame-Bild wechselt hart (kein Crossfade), Map-Pan/Zoom rendert sauber neu.