## Ziel

Die kontinuierliche Zeitachse und die Intensitäts-Interpolation bleiben unverändert (läuft „so gut wie es ist"). Zwei konkrete Fehler werden behoben:

1. **Ruckeln in Play/Scrub** — verursacht durch React-Re-Render pro Animation-Tick.
2. **Stopp am Seam Messung → Prognose** — verursacht durch Pipeline-Wechsel und teure PNG↔Grid-Blend-Rechnung genau am Übergangs-Frame.

Optik, Farben, Contour-Modulation, Advektion und die 15-Min-Rasterisierung werden nicht angetastet.

---

## Ursachenanalyse (konkrete Codepfade)

### Ursache Ruckeln
`src/components/maps/radar-map.tsx` Zeilen 2366–2389 (Play-rAF-Loop):
```text
tick() {
  playTimeRef.current = nextMs;
  setPlayVisualMs(nextMs);   // React re-render
  setRenderMs(nextMs);        // React re-render
  ...
}
```
Jeder rAF-Tick löst zwei `setState`-Aufrufe aus. `RadarMap` re-rendert komplett inkl. `timelineStateForMs`, `stripFrames`-Ableitungen, Filmstrip-Bubble-Position, `PrecipOverlay`/`MeasurementCanvasOverlay`-Props. Bei ~60 fps sind das ~60 vollständige Re-Renders pro Sekunde → sichtbares Ruckeln, besonders beim Scrub.

Zusätzlich löst Scrub jedes `pointermove` ein `setScrubVisualMs` aus (siehe FilmstripTimeline `onScrubMs`), was denselben Re-Render-Kaskaden-Effekt verursacht.

### Ursache Seam-Stopp
`src/components/maps/radar-map.tsx` Zeilen 2552–2586:
```text
const showPng  = !!overlayFrame && hasPng;
const showGrid = !!overlayFrame && hasGrid && !hasPng;
```
Am exakten Seam-Tick:
- `overlayFrame` springt von einem Frame mit `precipUrl` (radar) zu einem ohne (icon-ch1).
- `MeasurementCanvasOverlay` **unmountet**, `PrecipOverlay` wird sichtbar (opacity 0 → 0.6).
- Kurz vor dem Seam führt `MeasurementCanvasOverlay` in Zeilen 1628–1668 einen aufwendigen Blend (`sampleGridAt` inkl. `contourScaleAt`-fBm-Noise über den gesamten Canvas) durch — das ist der Frame, in dem der Layer stallt.

Ergebnis: ein sichtbarer Aussetzer plus Layer-Swap.

---

## Fix-Plan

### 1. rAF-Loop entkoppeln von React
- `playTimeRef` bleibt Single-Source-of-Truth für die Renderzeit.
- **Neuer Ref `renderMsRef`** wird der einzige Konsument für Overlays. Ein leichter Pub/Sub (`Set<() => void>` von Listenern) informiert Overlays pro Tick.
- Overlays (`PrecipOverlay`, `MeasurementCanvasOverlay`) registrieren einen Listener, der bei Tick `redrawRef.current()` aufruft — **ohne React-State**. Aktuelle `nextFrameRef`/`progressRef` werden ebenfalls direkt aus einer Timeline-Sampler-Funktion (`bracketFramesForMs`) im Listener aktualisiert.
- `setRenderMs`/`setPlayVisualMs` werden im rAF-Loop nur noch **max. alle 120 ms** (drossel) für UI-Elemente (Filmstrip-Bubble, Zeit-Label, idx) aufgerufen. Damit läuft die Karte mit 60 fps, während React ~8×/s rendert.

### 2. Scrub-Path analog entkoppeln
- Drag-Move schreibt Millisekunden direkt in `renderMsRef` und triggert Listener.
- `setScrubVisualMs` wird nur beim Drag-End (oder gedrosselt) gesetzt, für Labels.

### 3. Seam ohne Pipeline-Swap
- **Beide Overlays permanent gemountet** über die ganze Zeitachse, gesteuert nur über `opacity`:
  - `MeasurementCanvasOverlay` bleibt gemountet, solange der aktuelle **oder** benachbarte Frame ein PNG hat. Opacity springt am Seam hart auf 0 (kein Fade — Rahmen bleibt aber im DOM, kein Layer-Add/Remove).
  - `PrecipOverlay` wird **prewarmt** ab dem Frame vor dem Seam (opacity 0) und übernimmt am Seam mit opacity 0.6 in einem einzigen Tick.
- **Teuren PNG↔Grid-Blend am Seam entfernen:** Der Blend-Pfad `sampleGridAt`+`contourScaleAt` in `MeasurementCanvasOverlay` (Zeilen 1628–1668) wird gestrichen. Radar-Overlay rendert nur noch reines Radar; die Prognose-Übernahme erfolgt über den Grid-Layer, der bereits vorbereitet ist. Damit fällt der Stall-Frame weg.
- Für den ersten Prognose-Frame direkt nach dem Seam **Cache-Warmup** erzwingen: `buildOffscreenRef` wird für den letzten Radar-Zeitpunkt + den ersten Prognose-Frame beim Prewarm zwingend erzeugt, damit der Grid-Layer beim Seam ohne Erst-Render-Latenz aktiv wird.

### 4. Filmstrip-Bubble entkoppeln
- Position der Bubble wird über `ref` + `style.transform` in einem eigenen rAF-Loop aus `renderMsRef` gelesen, nicht mehr über React-State. Das entfernt eine Re-Render-Quelle während Play/Scrub.

### 5. Was NICHT geändert wird
- 15-Min-Rasterisierung (`playStepIndices`, `getRadarFrames`).
- Farbrampe (`colorFor`), Contour-Modulation im Prognose-Layer, Snow-Pfad.
- Bewegungsmodell: Intensitäts-Interpolation zwischen benachbarten Frames bleibt exakt wie heute (User: „läuft so gut wie es ist").
- Radar-PNG-Rendering und Hagel-Layer.
- `radar.functions.ts` bleibt komplett unangetastet.

---

## Verifikation

1. `bunx tsgo --noEmit`.
2. `/karten/radar` in Playwright öffnen, Play starten, Konsolen-Timing loggen (`performance.now()` in Listener) → messen: keine `> 30 ms`-Gaps am Seam-Zeitpunkt.
3. React-DevTools-artige Zählung via `useRef` Counter im `RadarMap`-Body: Re-Render-Frequenz während Play muss von ~60/s auf ≤ ~10/s fallen.
4. Manuell Scrub über den Seam ziehen → visuell prüfen: kein Aussetzer, keine Layer-Blink-Kante.

---

## Betroffene Dateien

- `src/components/maps/radar-map.tsx` (einzige Datei; Backend bleibt unverändert)
