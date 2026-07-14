## Ziel

Die Prognose-Animation im Radar soll aussehen wie ein klassisches Wetterradar (MeteoSchweiz/DWD): zusammenhängende Echos, die sich zwischen den Zeitschritten kontinuierlich verlagern. Kein Aufglühen, kein Abglühen, kein künstliches „Weiterschieben" mehr. Neue/verschwindende Zellen dürfen nur dann erscheinen/verschwinden, wenn die Prognosedaten das hergeben.

**Messung (MCH-CombiPrecip-PNG) bleibt unverändert** — nur die Grid-Prognose (`PrecipOverlay` mit `contour=true`) wird umgebaut.

## Diagnose

Zwei Effekte in `src/components/maps/radar-map.tsx` erzeugen den kritisierten Look:

1. `PrecipOverlay` läuft für Prognose-Frames mit `contour={true}` — das aktiviert einen fbm-Value-Noise-Modulator (`contourScale`), der aus den ICON-Feldern eine wolkige, sich am Rand ausfransende Struktur erzeugt. Das ist die „Partikel/Glow"-Optik.
2. Zwischen zwei Prognose-Frames wird nur die **Intensität** interpoliert (`buildBlendedOffscreenRef`: `v = (1−p)·A(x) + p·B(x)`). Kein Advektions- oder Optical-Flow-Warp — Zellen wechseln also durch Ein-/Ausblenden statt sich zu verlagern.

## Umbau

### 1. Glow-/Contour-Modulation vollständig entfernen

In `PrecipOverlay`:
- `contour`-Prop streichen (samt Aufrufstelle in `RadarMap`).
- `contourScale`-Feld aus `lookupRef` entfernen, samt fbm/valueNoise/warp-Block.
- `minV` fest auf `0.1` (gleicher Threshold wie Messung).
- Prognose-Grid mit derselben Pipeline rendern wie die Messung: bilineare Nachbar-Interpolation der Grid-Werte + harte Farbbänder via `colorFor` (bereits vorhanden).

Damit sehen Prognose-Frames aus wie klassische Radar-Echos: geschlossene, kantige Flächen in den MCH-Farbbändern.

### 2. Optical-Flow-Morphing zwischen benachbarten Prognose-Frames

Neuer Helper in `radar-map.tsx` (nur clientseitig, im Overlay-Modul):

- **Flow-Schätzung** pro Framepaar `(A, B)` auf dem nativen Grid (`nLat × nLon`, klein, typ. ≤ 200×200): Horn–Schunck, ~40 Iterationen, α ≈ 2. Input sind die Rohwerte (mm/h, ggf. auf `log(1+v)` gemappt für stabilere Gradienten). Ergebnis: zwei Float32Arrays `u`, `v` (Verschiebung pro Gridzelle in Gridkoordinaten pro Framepaar).
- **Cache**: `Map<key, {u,v}>` mit Key `${A.t}|${B.t}`, LRU, Deckel z. B. 32 Einträge. Berechnung idle-gescheduled beim ersten Bedarf, blockiert den ersten Render nicht (Fallback: reine Intensitäts-Interpolation, bis Flow bereit ist).
- **Morph-Sampling** in `buildBlendedOffscreenRef` (ersetzt heutige Intensitäts-Blende):
  - Für jeden Low-Res-Pixel: `(fx, fy)` in Gridkoords bestimmen (schon vorhanden via `lookup`), Flow `(uxy, vxy)` an `(fx, fy)` bilinear sampeln.
  - `vA = sample(A.values, fx − p·uxy, fy − p·vxy)`
  - `vB = sample(B.values, fx + (1−p)·uxy, fy + (1−p)·vxy)`
  - `v = (1 − p)·vA + p·vB` (Standard-Bild-Morphing / bidirektionaler Warp).
  - Analog für `snowValues`.
  - Farbe wie gehabt via `colorFor(v)`.
- **Effekt**: Ein Echo, das in A bei X und in B bei X+Δ liegt, wandert kontinuierlich von X nach X+Δ, statt bei X auszublenden und bei X+Δ einzublenden. Kein künstlicher Vorwärts-Shift, weil `u`/`v` direkt aus den Daten kommen; wo Δ ≈ 0 ist, gibt es keine Bewegung — wo eine Zelle in A oder B fehlt, bleibt nur der Intensitätsanteil und die Zelle entsteht/vergeht wie im Datensatz.

### 3. Aufrufstelle

In `RadarMap` (Zeile ~2130): `contour={gridFrame.source !== "radar"}` wird entfernt; `<PrecipOverlay …>` bekommt kein `contour`-Prop mehr. Alles andere (Opacity, Prewarm, Snow, Hail) bleibt.

### 4. Was NICHT geändert wird

- `MeasurementCanvasOverlay` (MCH-PNG) — 1:1 unverändert.
- Farbskala (`SCALE`, `colorFor`), Timeline, Play-Loop, Filmstrip, Hail-Layer.
- Datenpfad (`getRadarFrames`, `radar.functions.ts`, R2-Ingest).

## Technische Details

- Horn–Schunck-Kernel bleibt vollständig im Client, keine neue Abhängigkeit.
- Kosten pro Framepaar: ~ `nLat·nLon·iters` Multiply-Adds; für 200×200 × 40 Iter ≈ 1.6 M Ops → wenige ms auf Desktop, einmalig pro Paar, danach nur Sample-Blend im Redraw-Pfad.
- Cache-Invalidierung: Flow-Cache pro Framepaar (unabhängig vom View-Key, weil er im Gridraum lebt); Redraw-Cache (`cacheRef`) unverändert.
- Fallback ohne Flow (erste Frames, Rechenzeit-Limit): heutige Intensitäts-Interpolation — visuell identisch zu jetzt, aber nur als kurzer Übergang.

## Betroffene Datei

- `src/components/maps/radar-map.tsx` (einzige Änderung)
