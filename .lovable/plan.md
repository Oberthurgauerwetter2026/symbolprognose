## Ursache des Flackerns

Der aktuelle Domain-Warp wertet den Noise mit einem **zeitabhängigen** `zSlot` aus (`Date.parse(t)/900_000`, im Blend-Loop sogar linear zwischen zwei Frames driftend). Damit wird das Noise-Feld pro Animation-Tick neu abgetastet → Konturen zappeln.

Zusätzlich wird im Blend-Loop derselbe Warp-Offset `(dxN, dyN)` bei `(fxRaw, fyRaw)` (fester Bildschirm-Grid-Ort) für A und B verwendet. Wenn der Optical-Flow das Feld verschiebt, bleibt der Noise-Offset stehen — das Feature „läuft" durch eine ortsfeste Rauschmaske und deformiert sich sichtbar pro Frame.

## Fix (nur `src/components/maps/radar-map.tsx`, nur Prognose)

### 1. Noise wird zeitlich eingefroren

- `zSlot` in **allen drei Render-Loops** auf konstant `0` setzen (single-frame, buildOffscreen, buildBlended).
- `edgeJitter(..., z)` intern ebenfalls z=0 verwenden.
- Effekt: Value-Noise ist eine reine Funktion von (x, y) im Grid-Koordinatensystem — „haftet" in world space und wird niemals pro Frame neu gesampelt.

### 2. Warp folgt der Materie (Optical-Flow-kohärent)

Im Blend-Loop wird der Domain-Warp separat für A und B ausgewertet, jeweils an der bereits durch den Optical-Flow verschobenen Sample-Position:

- `dxA, dyA = warpSample(aSx, aSy) − (aSx, aSy)`
- `dxB, dyB = warpSample(bSx, bSy) − (bSx, bSy)`
- `va = sampleAt(aVals, aSx + dxA, aSy + dyA)`
- `vb = sampleAt(bVals, bSx + dxB, bSy + dyB)`

Damit sitzt die Rauschverformung fest am Material: Ein Echo, das laut Flow von Grid-Position P (Frame A) nach P′ (Frame B) wandert, trägt in beiden Frames denselben Warp-Offset. Zwischen den zwei Zeitschritten wird die Fläche nur noch translatiert/rotiert (durch den Flow) und sanft deformiert (weil `dxA/dyA` sich langsam ändert, wenn die Flow-Trajektorie eine variierende Region des Noise-Felds durchquert) — kein Zittern, kein Neu-Rauschen.

Analog für `snowFrac`: die Snow-Samples werden mit denselben `(dxA, dyA)` bzw. `(dxB, dyB)` versorgt.

### 3. Edge-Jitter identisch anankern

- Single-frame und buildOffscreen: `edgeJitter(fxRaw, fyRaw, 0)` — anker am Grid, stabil.
- Blend-Loop: der Multiplikator wird an der Material-Position ausgewertet, in derselben Logik wie der Warp: für die kombinierte Intensität wird zwischen `edgeJitter(aSx, aSy, 0)` und `edgeJitter(bSx, bSy, 0)` mit demselben `s` interpoliert. So bleibt die Kantentextur eines Echos beim Wandern konstant.

### 4. Cleanup

- Variablen `zA`, `zB`, `zSlot`-Interpolation entfernen.
- Kommentare aktualisieren („zeit-invariant, world-space anchored").

## Was unverändert bleibt

- Optical-Flow-Warp (Horn–Schunck) — sorgt weiterhin für die gleichmäßige Translation/Rotation der Felder mit konstanter Geschwindigkeit über die 15-min-Intervalle.
- Denoise (morphologische Öffnung).
- Farbskala, Bänder, Legende.
- Messung / MCH-PNG-Pfad.
- Datenlogik, Backend, Timeline.

## Erwartetes Verhalten

Radar-Loop wie DWD/MeteoSwiss: Zellen bewegen sich ruhig und kontinuierlich, ihre organische Form bleibt zwischen zwei Prognoseterminen visuell konstant und deformiert sich nur, wenn sich die Prognose-Daten selbst ändern.
