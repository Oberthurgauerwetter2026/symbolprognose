## Änderungen

### 1) `src/components/maps/radar-map.tsx` — Messung etwas mehr glätten

`MeasurementCanvasOverlay` (PNG-Pfad, Z. 1056-1162) bestimmt das Aussehen der Messung. Aktuell:
- `STEP = 2` → Offscreen-Raster ist nur halb so fein wie die Karte.
- `sampleAt` läuft nearest-neighbor → harte 1-km-Treppen, die fbm-Modulation kaschiert die Kante nur teilweise.

Anpassungen:
- `STEP = 2` → `STEP = 1`: Offscreen wird in voller Anzeigeauflösung gebaut, der finale `drawImage`-Upscale entfällt, Browser zeigt die Werte direkt.
- `sampleAt`: nearest → bilineare 4-Tap-Interpolation. Da `colorForSmooth` die Farben weiterhin in den definierten Bändern hält, „verwässert" das nicht — Übergänge zwischen Bändern werden nur entlang einer Pixel-Breite weicher.
- fbm-Modulation (Z. 1140-1149) und `colorForSmooth`-Bänder bleiben unverändert: organische Form, harte Farbskala.

Effekt: keine sichtbaren 1-km-Quadrate mehr, Farbbänder bleiben aber klar abgegrenzt.

### 2) `src/components/maps/radar-map.tsx` — sanfter Übergang Messung → Prognose

Im Play-Loop ist der letzte Messungs-Frame heute eine harte Schaltung auf den ersten Prognose-Frame, weil Messung über `MeasurementCanvasOverlay` (PNG) und Prognose über `PrecipOverlay` (Canvas-Grid) gerendert werden — zwei verschiedene Layer ohne gemeinsamen Fade.

Lösung — zusätzliche „Seam-Crossfade"-Schicht:
- Während Playback, wenn `currentFrame.source === "radar"` UND `playCrossfade.nextFrame` ein Forecast-Grid hat, zusätzlich einen `PrecipOverlay` einblenden mit
  - `frame = playCrossfade.nextFrame`
  - `opacity = opacityVal * playCrossfade.progress`
  - `contour = true`
  - kein eigener `nextFrame`/`progress` (würde doppelt überblenden)
- Sobald der Play-Cursor den ersten Forecast-Frame erreicht, fällt der Seam-Overlay weg und der normale Forecast-`PrecipOverlay` übernimmt — nahtlos, weil beide dieselbe Render-Pipeline benutzen.
- Pause/Scrub bleibt unverändert (kein Seam-Crossfade, frame-genaues Bild).

Die umgekehrte Richtung (Forecast → Radar) tritt im Play nicht auf (Cursor läuft vorwärts in der Zeit) und wird deshalb nicht eigens behandelt.

## Verifikation

- `bunx tsgo --noEmit` grün.
- `/karten/radar`:
  - Messung wirkt deutlich glatter, ohne dass Farbbänder verschwimmen.
  - Beim Play passiert am Seam Messung→Prognose ein sichtbarer, weicher Crossfade (kein Sprung mehr).
  - Beim Pausieren / Scrubben über den Seam bleibt das Bild frame-genau.
