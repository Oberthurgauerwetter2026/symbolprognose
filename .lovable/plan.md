## Ursache

Der Nowcasting-Anteil (Radar-Advektion mit `nc.vx/vy`) bewegt die Zellen korrekt: `estimateRadarMotion` mittelt gewichtet über die letzten 4 Messungen (5-min-Abstand), das Signal ist robust und die Richtung stimmt (verifiziert per Sampling-Konvention `sample(fx − v·dt)`).

Sobald wir jedoch tiefer in die Modellprognose kommen (Gewicht `w → 1`, ab ~120 min), übernimmt `buildFusionOffscreen` bzw. `buildMorphedOffscreen` das räumliche Morphing **zwischen zwei Modellframes im Stundenraster**. Der Shift wird dort per `estimateShiftCells(A, B)` neu geschätzt — komplett unabhängig vom Radar-Vektor:

- Suchfenster nur ±8 Zellen auf einem 32×32-Downsampling. Bei 1 h Abstand bewegen sich Zellen typischerweise deutlich weiter als 8 Zellen → NCC kann **nicht** den echten Peak finden, sondern rastet auf einen sekundären / spiegelnden Peak ein. Das ergibt sichtbar invertierte Bewegungen.
- Bei schwachen, weiträumigen Modellmustern liegt der beste NCC-Score oft nahe `−dx, −dy` (spiegelverkehrt), sobald das Muster einigermassen symmetrisch ist.
- Es gibt keinen Sanity-Check gegen die (verlässliche) Radar-Zugrichtung `nc.vx/vy`.

Am Übergang Nowcasting → Modell springt die Richtung dann sichtbar um.

Start/Ziel werden **nicht** vertauscht (`frame`/`nf` in `redraw` sind chronologisch, `sampleAt(A, fx − p·dx)` / `sampleAt(B, fx + (1−p)·dx)` ist konsistent zur Definition `A → B = (dx,dy)`). Das Problem ist ausschliesslich die fehlerhafte **Vorzeichen-/Betragsschätzung** von `estimateShiftCells` auf Stundenframes.

## Änderungen (nur `src/components/maps/radar-map.tsx`)

### 1) Radar-Motion als Prior für Modell-Morph

`estimateShiftCells` bekommt einen optionalen `prior`-Parameter (`{dx, dy}` in Zellen für den Frame-Abstand). Wenn gesetzt:

- Suchfenster wird um `prior` zentriert: `dx ∈ [prior.dx − R, prior.dx + R]`, `dy` analog, mit `R = 6`.
- Zusätzlich Score-Malus für grosse Abweichung vom Prior (leichter Gauss-Bias), damit spiegelverkehrte lokale Maxima nicht mehr gewinnen.
- Endgültiges Ergebnis wird verworfen (`return prior`), wenn `bestSc < 0.25` **oder** wenn `(best · prior) < 0` bei `|prior| ≥ 2` (harter Vorzeichen-Guard gegen Inversion).

### 2) Prior berechnen und weitergeben

`buildFusionOffscreenRef` und `buildMorphedOffscreenRef` bekommen Zugriff auf die Radar-Motion. Konkret:

- `nowcastRef.current` enthält bereits `vx, vy` (Zellen/min). In `buildFusionOffscreen` und `buildMorphedOffscreen` wird der Frame-Abstand `dtMin = (Date.parse(B.t) − Date.parse(A.t))/60000` bestimmt und `prior = { dx: nc.vx·dtMin, dy: nc.vy·dtMin }` gesetzt.
- `buildMorphedOffscreen` (reines Modell-Morph ohne Fusion) erhält denselben Zugriff via neuen optionalen Parameter oder via `nowcastRef` (bereits im Scope über closure).
- Fallback ohne Radar-Motion: verhalten wie heute (kein Prior, uneingeschränkte Suche).

### 3) Cache-Key erweitern

`shiftCacheRef`-Key heute: `${a.t}|${b.t}`. Damit ein Prior wirksam wird und nicht ein früher cachter „falscher" Shift ohne Prior zurückkommt: Key → `${a.t}|${b.t}|${Math.round(prior.dx*10)}|${Math.round(prior.dy*10)}` bzw. `noprior` wenn `prior` fehlt. Kein zusätzlicher Speicherdruck (dieselben Paare, andere Version-Signatur).

### 4) Konsistenz am Übergang

Am Seam (nowcast → erster Forecast) ist `canMorph` bereits false (Guard `source !== "radar"`), daher rein Radar-Advektion — bereits korrekt. Innerhalb der Fade-Zone `[T_NOW, T_FADE]` wird der Modell-Anteil jetzt ebenfalls in Radar-konsistenter Richtung morphiert; Vorzeichenkonflikt beim Übergang ist damit ausgeschlossen.

## Nicht angefasst

- `estimateRadarMotion`, Nowcast-Advektion, `sampleAt`-Konvention, Farben, Snow-Layer.
- Play-Loop, Scrubbing, `playStepIndices`.
- Server, R2, Ingest, Route.
- der Radar-Messung bleibt sonst unangetastet

## Verifikation

1. `/karten/radar`: Zellen bewegen sich über die gesamte Prognose (0 → 6 h+) in dieselbe Richtung wie im Nowcasting, keine sichtbare Richtungsumkehr am Übergang oder zwischen Stundenframes.
2. Manuelles Scrubbing bestätigt gleiches Verhalten.
3. `bunx tsgo --noEmit` grün.
4. Bei Situationen ohne verwertbare Radar-Motion (keine Zellen): Verhalten wie zuvor (kein Prior).