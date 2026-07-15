## Problem

Auf dem Prognose-Layer (`PrecipOverlay`) sieht der Niederschlag geometrisch aus (rechteckige/kapselförmige Blobs, Bild 1), weil das ICON-CH1-Grid nur ca. 36×22 Punkte hat und im Renderpfad rein bilinear interpoliert wird. Die bereits vorhandenen Helpers `denoiseGrid`, `warpSample` und `edgeJitter` sind definiert, aber im aktiven Renderpfad nicht verdrahtet. Zusätzlich existiert noch die alte Crossfade-/Optical-Flow-Blend-Funktion (`buildBlendedOffscreenRef`), obwohl der Kommentar sie schon als deaktiviert markiert.

## Fix (nur Frontend, nur `src/components/maps/radar-map.tsx`)

### 1. Prognose-Grid vor dem Rendern entrauschen ("Verunreinigung entfernen")

In `redrawRef.current` und `buildOffscreenRef.current` (Prognose-Renderpfade) vor dem Sample-Loop:

```ts
const cleanVals = isForecastFrame
  ? denoiseGrid(vals, nLon, nLat) ?? vals
  : vals;
const cleanSnow = isForecastFrame && snowVals
  ? denoiseGrid(snowVals, nLon, nLat) ?? snowVals
  : snowVals;
```

Sample-Loop verwendet ab dann `cleanVals` / `cleanSnow`. Damit fallen isolierte Streu-Pixel (die dunklen Sprenkel im Bild) weg. Messungspfad (`source === "radar"`) bleibt unverändert.

### 2. Organische Ränder via Domain-Warp + Edge-Jitter

Im Sample-Loop beider Prognose-Pfade nach dem Auslesen von `fxRaw/fyRaw`:

```ts
const zSlot = Date.parse(f.t) / 900_000; // stabil pro Frame, driftet in der Zeit
const [sxW, syW] = warpSample(fxRaw, fyRaw, zSlot, 0.6);
let v = sampleAt(cleanVals, sxW, syW) * edgeJitter(fxRaw, fyRaw, zSlot);
```

Der Warp verzerrt die Sample-Koordinaten mit einem niederfrequenten fBm-Feld (Amplitude ≈ 0,6 Grid-Zellen), die Edge-Jitter-Modulation (±12 %) fransen die Bandgrenzen von `colorFor` aus. Ergebnis: gleiche Kerne, aber unregelmäßige, natürliche Aussenränder wie bei der Messung.

`zSlot` ist deterministisch pro Frame → keine wackelnde Eigenbewegung; keine Wind-Advektion, keine künstliche Bewegung.

### 3. Cache-Key erweitern

`cacheKey` muss den Warp-Slot enthalten, sonst zeigt der Cache alte, ungewarpte Bilder:

```ts
const cacheKey = `${frame.t}|${frame.source ?? ""}|w1`;
```

(In beiden Prognose-Pfaden identisch.)

### 4. Crossfade endgültig entfernen

- `buildBlendedOffscreenRef` (Funktion + Ref), `blendCanvasRef`, `nextFrameRef`, `progressRef`, sowie den `useEffect` der `nextFrame/progress` in Refs spiegelt, komplett löschen.
- Aufrufer im JSX (`nextFrame`, `progress` Props an `<PrecipOverlay>`) entfernen; `<PrecipOverlay>`-Signatur säubern (`nextFrame`, `progress` aus Props raus).
- Der bereits vorhandene Kommentar "Crossfade/Optical-Flow-Blend deaktiviert" bleibt korrekt; nur die tote Code-Basis wird entsorgt.

### 5. Messung unangetastet

`MeasurementCanvasOverlay` sowie der `source === "radar"`-Zweig in `PrecipOverlay` erhalten weder Warp noch Denoise — die Messung ist bereits pixelnativ organisch (700×… PNG).

## Scope

- Datei: `src/components/maps/radar-map.tsx`.
- Kein Backend-, Ingest-, oder Timeline-Change.
- Kein neuer Helper — nutzt ausschliesslich bereits vorhandene Funktionen (`denoiseGrid`, `warpSample`, `edgeJitter`).
