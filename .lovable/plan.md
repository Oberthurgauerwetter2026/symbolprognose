# Sauberere Zellverlagerung — Stufe 1 + 2

Messung (MeteoSchweiz-PNGs, R2-Manifest, Ingest, GitHub Action, Cron, `past_minutely_15`-Canvas-Pfad) bleibt **komplett unangetastet**. Änderungen ausschliesslich im Prognose-Pfad von `src/lib/radar.functions.ts`.

## Ziel

Das Pulsieren zwischen den Stunden­ankern eliminieren und Zellen sichtbar entlang ihrer **tatsächlichen Bewegungs­richtung** verlagern — nicht entlang des groben 700-hPa-Modell­winds.

## Stufe 1 — Closest-Cell-Blending statt linearem Crossfade

Aktuell: `value = (1−α)·A_fwd + α·B_bwd` → bei α≈0.5 zwei halbtransparente Zellen sichtbar (Pulsieren).

Neu: pro Ziel-Pixel **distanz­gewichtetes Maximum**:

```text
if A_fwd ≥ B_bwd:  value = A_fwd · (1 − soft·α)  + B_bwd · soft·α
else:              value = B_bwd · (1 − soft·(1−α)) + A_fwd · soft·(1−α)
```

mit `soft = 0.3` (sanfter Übergang, kein hartes Switch). Bei gut überlappenden Zellen → praktisch wie vorher. Bei räumlich versetzten Zellen → die dominantere Zelle gewinnt, kein Doppel-Geist.

Alternativ noch sauberer: **Distance-Transform-Blending** — zu jedem Pixel die Distanz zur nächsten "echten" Zelle in A_fwd bzw. B_bwd bestimmen, Gewicht = inverse Distanz. Wird nur eingebaut, falls Variante oben noch sichtbar pulsiert.

## Stufe 2 — Optical Flow ersetzt 700-hPa-Wind

Statt `uHour`/`vHour` aus ICON-Wind, berechnen wir Bewegungs­vektoren aus zwei aufeinander­folgenden Niederschlags­feldern selbst.

### Algorithmus: Pyramidal Lucas-Kanade auf 36×22-Grid

Pro Anker­paar (A, B) im Stunden­abstand:

1. **Pyramide** in zwei Stufen (18×11 → 36×22), bilineares Downsample.
2. **Auf jeder Stufe** für jeden Grid­punkt (i,j):
   - Fenster 5×5 um (i,j) in A.
   - Gradienten `Ix, Iy` (zentrale Differenzen auf A), Zeit­differenz `It = B−A`.
   - Lösen des 2×2-Systems `[ΣIx² ΣIxIy; ΣIxIy ΣIy²] · [u;v] = -[ΣIxIt; ΣIyIt]`.
   - Bei singulärer Matrix (kein Gradient) → (0,0).
3. **Upsample** des Flow-Feldes von grob → fein, Verfeinerung auf der feinen Stufe mit gewarptem A.
4. **Cap** auf physikalisch sinnvolle Werte: max 30 m/s, glätte mit 3×3-Box-Filter.

Output: `flowU[GRID_LAT][GRID_LON]`, `flowV[...]` in m/s — Einheit kompatibel zur bestehenden `advectField`.

### Fallback

Wenn Flow-Magnitude < 1 m/s an einem Punkt UND ICON-Wind > 3 m/s → ICON-Wind verwenden (Übergangs­bereiche ohne Niederschlag, in die Zellen reinwandern). Per-Pixel-Blend mit Gewicht aus lokaler Niederschlags­intensität.

### Wind-Felder bleiben erhalten

`uHour`/`vHour` aus 700 hPa werden **nicht entfernt** — sie dienen als Fallback (siehe oben) und als Sanity-Check bei numerisch instabilen Flow-Lösungen.

## Konkrete Änderungen — nur `src/lib/radar.functions.ts`

1. **Neue Helper-Funktionen** (Modul-Scope, oberhalb des Handlers):
   - `computeOpticalFlow(fieldA, fieldB, dtSeconds): { u: number[][], v: number[][] }` — pyramidal Lucas-Kanade.
   - `warpField(field, u, v, dt, lats, lons)` — identisch zu bisherigem `advectField`, nur umbenannt zur Klarheit.
   - `blendClosestCell(aFwd, bBwd, alpha, soft)` — Stufe-1-Blending.
   - `boxFilter3(field)` — 3×3 Glättung des Flow-Feldes.

2. **Pro Anker­paar einmalig** (vor der 15-min-Frame-Schleife):
   - `const flow = computeOpticalFlow(precipHour[a], precipHour[a+1], 3600)`.
   - `const { u, v } = blendFlowWithWind(flow, uHour[a], vHour[a], precipHour[a])` — Fallback-Logik.
   - Cache pro `a`, damit wiederverwendet für alle vier 15-min-Frames im Stunden­intervall.

3. **Frame-Schleife angepasst**:
   - `A_fwd = warpField(precipHour[a], u, v, +α·3600, ...)`.
   - `B_bwd = warpField(precipHour[a+1], u, v, −(1−α)·3600, ...)`.
   - `value = blendClosestCell(A_fwd, B_bwd, α, 0.3) · biasCorrection`.
   - Schnee analog mit demselben Flow-Feld (Schnee folgt dem Niederschlags­muster).

4. **Bias-Korrektur, Farb­palette, Canvas-Renderer, Crossfade/Pause-Tween** — unverändert.

## Performance

- Optical Flow: 36×22 = 792 Punkte × 2 Pyramiden­stufen × ~30 Ops = ~50k Ops pro Anker­paar.
- 24 Anker­paare (24 h) × 50k = 1.2M Ops pro Request → < 20 ms in V8.
- Warping: wie bisher, ~800 bilineare Lookups pro Frame, 96 Frames = vernachlässigbar.

## Nicht angefasst

- MeteoSchweiz-Messpfad (PNGs, R2-Manifest, `past_minutely_15`-Canvas-Füllung).
- Ingest-Skript, GitHub Action, Cron, Cloudflare Worker.
- ICON-CH2 (bleibt deaktiviert).
- `LocResponse`-Typ (Wind-Felder bleiben, werden als Fallback genutzt).
- Farb­palette, Canvas-Renderer, Crossfade-/Pause-Tween-Logik, Bias-Korrektur.

## Verifikation

- `bunx tsc --noEmit` muss durchgehen.
- Visuell im Preview: kein Pulsieren mehr bei α≈0.5, Zellen bewegen sich erkennbar entlang ihrer Eigen­richtung (kann von 700-hPa-Wind abweichen).
