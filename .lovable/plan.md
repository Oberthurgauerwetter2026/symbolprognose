## Problem

Die Prognose-Animation flackert/flimmert, weil zwei prozedurale Effekte pro (Sub-)Frame neu berechnet werden:

1. **Domain-Warp (`warpSample` / `fbm2`)** verzerrt die Sample-Koordinaten mit einem zeitabhängigen Noise-Feld. Der Warp-Offset ändert sich zwischen Frames → Kanten wackeln, Zellen „atmen" sichtbar.
2. **Edge-Jitter (`edgeJitter`)** moduliert die Intensität nahe der Isolinien mit `z*3+1` in Noise-Koordinaten. In Kombination mit den **hart quantisierten Farbbändern** aus `colorFor` springen Pixel bei jedem Frame in ein anderes Band → klassisches Flackern an den Rändern.

Die Bewegung selbst (Horn–Schunck Optical Flow) ist korrekt und bleibt erhalten. Sie soll allein für die Verlagerung der Felder verantwortlich sein — genau wie bei MeteoSchweiz / MCH.

## Ziel

Prognose-Niederschlag sieht aus wie MCH-CombiPrecip: zusammenhängende, weiche, farblich gestufte Radar-Echos, die sich fliessend über die Karte verlagern. Kein Flackern, kein Flimmern, kein prozedurales „Atmen".

## Änderungen (nur `src/components/maps/radar-map.tsx`, nur Prognose-Pfad)

### 1. Prozedurale Deformation entfernen
- `warpSample(...)`-Aufrufe in allen drei Render-Loops (Inline-Single-Frame, Prewarm-Cache, Blend-Loop mit Optical Flow) rausnehmen. `fxRaw / fyRaw` gehen direkt in `sampleAt`.
- `edgeJitter(...)`-Multiplikation entfernen — der `v`-Wert kommt unverändert aus der bilinearen Interpolation.
- Hilfsfunktionen `warpSample`, `edgeJitter`, `fbm2`, `valueNoise2`, `_valueNoise2Int`, `_hash3i` bleiben als reine Utilities im File erhalten, werden aber nicht mehr aufgerufen (können in einem späteren Cleanup entfernt werden). Kein Verhalten hängt sonst dran.

### 2. Weiche Farbbänder für Prognose
- Prognose-Rendering nutzt `colorForSmooth` statt `colorFor`. Log-Interpolation zwischen den SCALE-Stufen gibt sanfte Farbübergänge → keine harten Iso-Sprünge mehr, an denen Optical-Flow-Subpixel-Bewegung als Flimmern sichtbar wird.
- Messung (`frame.source === "radar"`, MCH-PNG-Pfad) bleibt bit-genau bei `colorFor` bzw. dem gelieferten PNG — unverändert.

### 3. Denoise beibehalten
- `denoiseGrid` (morphologische Öffnung, isolierte Streu-Pixel raus) bleibt aktiv — sie ist zeitlich stabil (per-frame gecached auf `values`-Referenz) und trägt nicht zum Flackern bei.

### 4. Rendering-Feinheiten
- `imageSmoothingQuality` beim finalen `drawImage` der Prognose zurück auf `"high"`. Ohne die prozedurale Struktur ist ein weicheres Resampling gewollt und ergibt MCH-ähnliche runde Echo-Ränder.
- Keine Änderung an: Farbskala `SCALE`, Legende, Schnee-Farben, Hagel, Timeline, Filmstrip, Play/Scrub, Prewarm-Cache-Keys, Horn–Schunck Optical Flow (u,v), Blend-Gewichtung, Cache-Grössen.

## Unverändert

- MCH-CombiPrecip-Messung (`MeasurementCanvasOverlay`, PNG-Pfad) — bit-genau.
- Horn–Schunck Optical-Flow, `FLOW_CACHE`, Frame-Pair-Auswahl.
- `radar.functions.ts`, `RadarPayload`, Backend, Ingest.
- Farbdefinitionen, Legende, UI-Kontrollen.

## Erwartetes Ergebnis

- Kein sichtbares Flackern/Flimmern zwischen Sub-Frames mehr.
- Felder verlagern sich durchgehend via Optical Flow — Form ändert sich nur, wenn die Daten sie ändern.
- Ränder wirken weich und gestuft wie auf meteoschweiz.admin.ch/…/niederschlag.
