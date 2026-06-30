## Ziel
Die Prognose-Animation auf `/karten/radar` soll wie bei Profi-Radaren wirken: Niederschlagszellen wandern sichtbar weich über die Karte, mit Zwischenframes alle 15 min — auch jenseits +24 h, wo die Quelle nur Stundenframes liefert. Mess-Darstellung (`source === "radar"`) bleibt zu 100 % unangetastet.

## Heutiger Stand
- `playStepIndices` (radar-map.tsx Z. 1824–1886): 5 min Messung → 15 min bis +24 h → **60 min** nach +24 h.
- Play-Loop emittiert pro Tick `{nextFrame, progress}` an `PrecipOverlay`.
- `PrecipOverlay` (Z. 715–732) blendet `nextFrame` nur per **globalem alpha-Crossfade** über `frame` — keine räumliche Bewegung, daher der "Stillstand-mit-Aufhellen"-Look.

## Änderungen

### 1) 15-min-Cadence über die volle Prognose (radar-map.tsx, `playStepIndices`)
- Phase B (60 min nach +24 h) entfällt: ein einziges 15-min-Raster von `nowMs` bis `lastMs`.
- `pickNearest` darf bei diesem Raster Zielzeiten ohne realen Frame **nicht** überspringen — stattdessen wird die Zielzeit als **virtueller Step** zwischen den beiden umliegenden Forecast-Frames eingetragen. Datenstruktur ändern:
  ```
  type PlayStep =
    | { kind: "real"; idx: number; t: number }
    | { kind: "virtual"; aIdx: number; bIdx: number; t: number; alpha: number }
  ```
- `stepCursorForIndex`, `stripFrames`, `stripNowIdx` arbeiten weiter über `real`-Steps (Filmstrip zeigt unverändert nur echte Frames, damit Scrubben/Snapping & Beschriftung intakt bleiben).

### 2) Play-Loop nutzt PlayStep direkt
- Pro Tick:
  - `real` → wie heute: `setIdx(step.idx)`, `nextFrame` = nächster `real`-Frame, `progress = p`.
  - `virtual` → `setIdx(step.aIdx)`, `nextFrame = frames[step.bIdx]`, `progress = step.alpha + p * Δalpha` mit Δalpha = alphaDistanzZumNächstenStep.
- `setPlayVisualMs` bleibt auf `aMs + (nMs-aMs)*progress` für Bubble/Marker — keine Sprünge.
- Echte 5-min-Mess-Steps verhalten sich exakt wie bisher.

### 3) Räumliche Advektion in `PrecipOverlay` (nur Forecast-Paare)
Ersetzt den reinen alpha-Crossfade durch morph-basierte Interpolation, wenn **beide** Frames `source !== "radar"` sind und `prog ∈ (0,1)`.

a) **Shift-Schätzung pro Forecast-Paar** (Cache `Map<"<aT>|<bT>", {dx,dy}>`):
   - Einmaliger Brute-Force-NCC auf einem stark heruntergesampelten mm/h-Grid (≈ 32×32) über ein Suchfenster `±8` Zellen (≈ ±15 km bei 1 km Grid).
   - Liefert globalen Verschiebungsvektor in **Grid-Zellen**, gültig für das ganze Paar. Reicht für "Zellen wandern", ist O(32·32·17·17) ≈ 300k Multiplikationen → sub-ms, einmal pro Paar.
   - Cap auf max. ±10 Zellen, sonst Vektor verwerfen (instabile Schätzung).

b) **Sample-Pfad in `buildOffscreenRef`** erweitern um eine optionale Override-Variante `buildMorphedOffscreen(a, b, p)`:
   - Statt `f.values` direkt zu samplen, sampelt sie an `(fx, fy)` ein advektiertes mm/h:
     ```
     s  = smoothstep(p)                       // weiche Bewegung
     va = sampleBilinear(a.values, fx - p·dx, fy - p·dy)
     vb = sampleBilinear(b.values, fx + (1-p)·dx, fy + (1-p)·dy)
     v  = (1-s)·va + s·vb                     // weicher Intensitäts-Blend
     ```
   - Identisches `colorFor`, gleiche Schwellen, gleiches Low-Res-Raster.
   - Snow-Anteil (`snowVals`) analog interpoliert.

c) **Render-Pfad in `redrawRef`**:
   - Mess-Frames (`a.source === "radar"`) → bestehender Code unverändert (Cache + Crossfade).
   - Forecast + `nf` vorhanden + `prog > 0` → `buildMorphedOffscreen(a, nf, prog)` → drawImage; **kein** zweites Drawimage, kein alpha-Crossfade mehr.
   - Forecast ohne `nf`/`prog === 0` → bestehender Cache-Pfad.

d) **Cache-Disziplin**:
   - Gemorphte Canvases werden **nicht** in `cacheRef` abgelegt (sonst Cache-Explosion).
   - Stattdessen ein 1-Slot-Reuse: `morphCanvasRef` (eine `OffscreenCanvas`-ähnliche `HTMLCanvasElement`) wird pro Tick wiederbeschrieben.

### 4) Performance-Schutz
- Schätzung der Shift läuft synchron beim ersten Bedarf eines Paares; Resultat in `Map` → konstant pro Pair während Play.
- Low-Res `lowW/lowH` bleibt unverändert (Mobile-tauglich, gleiches Raster wie heute).
- `imageSmoothingQuality = "high"` beim Upscale bleibt.
- Pre-Warm-Loop (Z. 832–900) bleibt unverändert — er warmt nur die echten Frame-Caches; virtuelle Steps brauchen keinen Vor-Cache.

## Was nicht angefasst wird
- Mess-Layer (`PrecipOverlay` für `source === "radar"`, `MeasurementCanvasOverlay`, Hagel).
- Filmstrip-Inhalte, Beschriftungen, Farbskalen, `colorFor`.
- `getRadarFrames`, Cache, R2-Pfade, alle Server-Files.
- Niederschlag-Akkumulationskarte (`/karten/niederschlag`).

## Verifikation
- `/karten/radar`: Play startet, Bubble läuft kontinuierlich in 15-min-Schritten bis +48 h; zwischen zwei Stunden-Forecast-Frames wandern die Niederschlagsflächen sichtbar in eine kohärente Richtung, ohne "Geist-Doppelbild".
- Mess-Phase (5-min) visuell identisch zu heute.
- Filmstrip rastert weiter auf echte Frames (Klick/Scrub bleibt frame-genau).
- Mobile (DevTools Throttling Mid-Tier): Play bleibt ≥ 30 fps, kein neuer Memory-Sprung.

## Technische Stichpunkte
- Datei: `src/components/maps/radar-map.tsx` (einzige Änderung).
- Neue Helfer (am Modul-Top, nahe `PrecipOverlay`):
  - `estimateShiftCells(a: RadarFrame, b: RadarFrame, gridW: number, gridH: number): {dx:number,dy:number} | null`
  - `smoothstep(p) = p*p*(3-2*p)`
- Neue Refs in `PrecipOverlay`: `shiftCacheRef: Map<string,{dx,dy}|null>`, `morphCanvasRef: HTMLCanvasElement|null`.
- Keine neuen Dependencies.
