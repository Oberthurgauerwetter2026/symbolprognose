## Ziel

Prognose-Frames werden **exakt gleich** gerendert wie die Messung: dieselben harten Farbbänder, dieselbe Pixel-Struktur, keine Überblendung zwischen Frames, keine prozeduralen Effekte. Ein Prognose-Frame sieht aus wie ein Messrahmen — beim Weiterschalten wechselt das Bild direkt, so wie Messframes heute auch direkt wechseln.

## Änderungen (nur `src/components/maps/radar-map.tsx`, nur Prognose-Pfad)

### 1. Crossfade / Optical-Flow-Blend entfernen
- Der Blend-Loop, der zwei Prognose-Frames per Horn–Schunck-Flow (`u,v`) und `prog`-Gewichtung mischt, wird für die Prognose deaktiviert. `blendActive` ist für Prognose-Frames immer `false`; es wird immer der aktuelle Einzelframe gezeichnet.
- `buildBlendedOffscreenRef` / `FLOW_CACHE` / `blendCanvasRef` bleiben als Code erhalten, werden aber nicht mehr aufgerufen (späterer Cleanup möglich). Kein Verhalten hängt sonst dran.
- Sub-Frame-Fortschritt (`prog`) hat für Prognose keine visuelle Wirkung mehr — der Frame wird beim Übergang zum nächsten Zeitschritt hart gewechselt, identisch zum Messverhalten.

### 2. Prognose zeichnet wie Messung
- Prognose-Rendering nutzt denselben Pfad wie `MeasurementCanvasOverlay`: `colorFor(v)` (harte Bänder), keine `colorForSmooth`-Interpolation.
- `denoiseGrid` wird für Prognose entfernt — die Messung zeigt Rohpixel inkl. Streu-Zellen, die Prognose soll dieselbe Struktur haben.
- `imageSmoothingEnabled = true` / `Quality = "high"` beim `drawImage` bleibt (wie in der Messung).
- Keine `warpSample`- / `edgeJitter`-Aufrufe (bereits entfernt) — bleiben entfernt.

### 3. Unverändert
- `MeasurementCanvasOverlay` und der MCH-PNG-Pfad — bit-genau.
- Farbskala `SCALE`, Legende, Schnee-Farben, Hagel-Overlay.
- Timeline, Filmstrip, Play/Scrub, Frame-Auswahl, Prewarm-Cache-Keys.
- `radar.functions.ts`, `RadarPayload`, Backend, Ingest.

## Erwartetes Ergebnis

- Prognose-Zellen haben **exakt** dieselbe organische, gepixelte Form wie Messzellen — keine geometrischen Kapseln, keine glatten Farbverläufe, keine ausgefransten Ränder aus Noise.
- Beim Abspielen wechselt das Prognosebild frameweise (wie die Messung), ohne Überblendung, ohne künstliche Bewegung zwischen Zeitschritten.
- Formen und Positionen entsprechen 1:1 den Prognosedaten pro Zeitschritt.

## Technische Details

- `blendActive` (Zeile ~985) wird auf `frame.source === "radar" && ...` eingeschränkt bzw. für Forecast auf `false` gesetzt; damit greift der Einzel-Frame-Zweig (`ctx.drawImage(offscreen, ...)`).
- In allen drei Render-Loops (inline single-frame Zeile ~955, prewarm-cache Zeile ~1098, blend-loop Zeile ~1255) wird `isForecastFrame ? colorForSmooth(v) : colorFor(v)` durch `colorFor(v)` ersetzt.
- `denoiseGrid`-Aufrufe für Prognose (Zeilen ~842, ~1040, ~1140, ~1193) werden durch die Rohwerte ersetzt: `const values = rawVals; const snow = rawSnow;`.
- Blend-Loop-Code bleibt physisch im File, wird aber durch die `blendActive`-Bedingung nicht mehr betreten.