## Ziel

Prognose-Niederschlagsflächen sollen nicht mehr wie glatte Kapseln/Würste/Sechsecke aussehen, sondern wie echte Radar-Echos: unregelmäßige, leicht ausgefranste Konturen, natürliche Verformung während der Animation, kein wiederkehrendes Muster. Zusätzlich sollen die isolierten „Verunreinigungen" (einzelne verstreute Pixel im rechten Screenshot) verschwinden. Messung (MCH-PNG) bleibt unverändert.

## Ursache heute

Die Prognose rendert aus einem sehr groben Grid (36×22) mit reiner bilinearer Interpolation und `imageSmoothingQuality: "high"`. Dadurch entstehen zwangsläufig glatte, ellipsen-/kapselartige Blobs. Isolierte Grid-Zellen mit >0.1 mm/h werden 1:1 als kleine ovale Klumpen gerendert → „Verunreinigungen".

Optical-Flow-Warp aus dem letzten Schritt bleibt korrekt — er verschiebt die Felder, formt sie aber nicht.

## Änderungen (nur `src/components/maps/radar-map.tsx`, nur Prognose-Pfad)

### 1. Organische Kontur per Domain-Warp

In beiden Sample-Loops (Single-Frame ab Zeile ~799 und Blend-Loop ab Zeile ~1044) wird die Grid-Sample-Koordinate `(fxRaw, fyRaw)` vor dem `sampleAt`-Aufruf mit einem **niederfrequenten fBm-Noise-Feld** verzerrt:

- 2 Oktaven Value-Noise, Basis-Wellenlänge ≈ 1.2 Grid-Zellen (in Grid-Koordinaten).
- Amplitude ≈ 0.55 Grid-Zellen in x/y — genug, um sichtbare Ausfransungen und ineinander verlaufende Ränder zu erzeugen, zu wenig, um Position/Bewegung zu verfälschen.
- Deterministisch gehasht aus `(gridX, gridY, tSlot)`. `tSlot = Math.floor(frameIndex + progress * 4) / 4` — die Verformung driftet damit langsam über die Animation (Zellen „atmen"), springt aber nicht sichtbar.
- Beim Blend-Loop wird zusätzlich die Warp-Amplitude linear zwischen den zwei Framepaaren geglättet, damit die Deformation über den Optical-Flow-Warp keine sichtbare Sprungnaht bekommt.

Ergebnis: Ränder werden unregelmäßig, Zellen wachsen zusammen bzw. teilen sich rein durch die Konturverformung — der geometrische Grundriss verschwindet.

### 2. Zusätzliche Kantenrauhigkeit

Nach dem verzerrten Sample wird der Wert mit einem zweiten, feineren fBm (Wellenlänge ≈ 0.5 Grid-Zellen, Amplitude ±12 %) moduliert:  
`v *= 1 + 0.12 * noiseHi(gx, gy, tSlot)`

Wirkung nur nahe der Isolinien (`colorFor` quantisiert ja hart in Bänder): dort entstehen kleine „Auszipfelungen" wie bei echtem Radar. In dichten Kerngebieten hat die Modulation keinen sichtbaren Effekt (Farbband bleibt).

### 3. Denoise / „Verunreinigungen" entfernen

Vor dem Rendern (einmal pro Frame, gecached zusammen mit dem Grid-Lookup) wird ein Cleanup-Pass über die Grid-Werte ausgeführt:

- Für jede Zelle mit `v ≥ 0.1 mm/h`: zähle Nachbarzellen (3×3) mit `v ≥ 0.1`.
- Bei `< 2` Nachbarn: Zelle wird für's Rendering auf 0 gesetzt (Kopie, Rohdaten bleiben unangetastet, damit Optical-Flow und andere Auswertungen unverändert bleiben).
- Wirkung: klassische morphologische Öffnung → einzelne Streu-Pixel/Punkte verschwinden, zusammenhängende Felder bleiben identisch.

Denselben Filter analog für `snowValues`.

### 4. Rendering-Feinheiten

- `imageSmoothingQuality` beim finalen `drawImage` von `"high"` auf `"medium"` — die Kanten wirken damit weniger geglättet, ohne pixelig zu werden. Domain-Warp liefert die Struktur; kein zusätzlicher Blur.
- Keine Änderung an Farbskala, Bänder, Legende, Timeline, Messung, Hagel oder Schnee-Farben.

## Unverändert

- MCH-CombiPrecip-Messung (`MeasurementCanvasOverlay`, PNG-Pfad).
- Horn–Schunck-Optical-Flow zwischen zwei Prognosefeldern.
- Farbskalen `SCALE`, `colorFor`, `snowColorFor`, Legende.
- Datenstruktur `RadarPayload`, Backend `src/lib/radar.functions.ts`.
- Timeline, Filmstrip, Play/Scrub, Prewarm-Cache.

## Technische Details

- Noise: kleiner, allokationsfreier Hash-basierter Value-Noise inline in `radar-map.tsx` (keine neue Dependency). Signatur `noise2(x, y, z) → [-1, 1]`.
- `tSlot`-Quantisierung verhindert, dass der Warp bei jedem Sub-Frame neu jittert (was als Flimmern sichtbar wäre).
- Denoise-Kopie in einem `Float32Array` pro Frame, memoisiert per `WeakMap<number[], Float32Array>` auf die `values`-Referenz — kostet praktisch nichts nach dem ersten Render.
- Nur der Prognose-Rendering-Pfad wird berührt; Messung (`hasRealRadar` + `precipUrl`) bleibt bit-genau gleich.
