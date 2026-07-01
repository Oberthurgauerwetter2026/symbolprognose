# Plan: Kontinuierliche Regenradar-Prognose

Alle Änderungen leben in `src/components/maps/radar-map.tsx`. Keine neuen Deps, keine Server-Änderungen, Mess-Layer (`source === "radar"`, unter `nowMs`) bleibt exakt wie heute.

## Kernidee

Statt frame-für-frame Alpha/Morph zwischen zwei benachbarten Frames zu bauen, wird ein **zeitbasierter Sampler** eingeführt:

```
sampleRadarAt(tMs) -> { valuesLow: Float32Array, snowLow: Float32Array }
```

`sampleRadarAt` liefert für **beliebige** `tMs` ein fertiges Low-Res-mm/h-Grid, das identisch von Play-Loop **und** Scrubbing genutzt wird. Dadurch gibt es genau **einen** Rechenpfad — automatisch sprungfrei.

Der Sampler kombiniert drei Quellen:

1. **Reine Messung** (`tMs ≤ nowMs`, immer echter Radar-Frame): unverändert, wie heute.
2. **Nowcasting** (`nowMs < tMs ≤ nowMs + T_NOW`, z. B. `T_NOW = 60 min`): letzter Radar-Frame räumlich advektiert mit einem aus den letzten Messungen geschätzten Bewegungsvektor.
3. **Modellprognose** (Prognose-Frames im Stundenraster): räumlich advektierte Interpolation zwischen den beiden umschließenden Prognose-Frames, wie heute in `buildMorphedOffscreen`.

**Fusion 2↔3:** Über ein Übergangsfenster `T_NOW … T_FADE` (z. B. 60–120 min) wird ein Blend-Gewicht `w(tMs) = smoothstep((tMs - t0)/(t1 - t0))` berechnet, mit dem Nowcast- und Modell-Grid pixelweise gemischt werden. Vor `T_NOW` reines Nowcasting, nach `T_FADE` reines Modell — dazwischen weicher Übergang.

## Änderungen im Detail

### 1) Nowcast-Bewegungsvektor aus letzten Radar-Frames

Neuer Helper am Modul-Top:

```
estimateRadarMotion(frames, nowIdx) -> { vx, vy }   // Zellen pro Minute
```

- Nimmt die letzten N Radar-Frames (z. B. 3, ~15 min) und schätzt paarweise per bestehendem `estimateShiftCells` einen Shift.
- Rechnet auf Zellen/min um und mittelt (gewichtete Glättung, jüngstes Paar am stärksten).
- Fallback: `{0,0}`, falls Signal zu schwach.

Ergebnis wird in einem Ref gecached und nur neu berechnet, wenn sich `nowIdx` (jüngster Mess-Frame) ändert.

### 2) Zeitbasierter Sampler

Neu in `PrecipOverlay` (bzw. als Hook `useRadarSampler(payload, frames)`):

```
sampleRadarAt(tMs): { valuesLow, snowLow, hasData }
```

Interne Logik:

- **Messung** (`tMs ≤ nowMs`): finde nächsten Radar-Frame → gib dessen Low-Res-Grid zurück (aus dem bestehenden `buildOffscreen`-Pfad extrahiert, so dass wir sowohl das Grid als auch das gerenderte Canvas bekommen).
- **Nowcast-Grid** `N(tMs)`: `dt = (tMs - nowMs)/60000`; sample letzten Radar-Frame an `(fx - vx*dt, fy - vy*dt)` bilinear.
- **Modell-Grid** `M(tMs)`:
  - finde umschließende Forecast-Frames `a, b` mit `ta ≤ tMs ≤ tb`.
  - `p = (tMs - ta)/(tb - ta)`, `s = smoothstep(p)`.
  - globaler Shift `(dx,dy)` aus `estimateShiftCells(a,b)` (bereits vorhanden, gleicher Cache).
  - `va = sample(a, fx - p·dx, fy - p·dy)`, `vb = sample(b, fx + (1-p)·dx, fy + (1-p)·dy)`.
  - `M = (1-s)·va + s·vb`.
- **Fusion**:
  - `w = smoothstep(clamp((tMs - (nowMs+T_NOW))/(T_FADE - T_NOW), 0, 1))`.
  - `out = (1-w)·N + w·M`.
- Für Zeiten `> letzter Forecast-Frame`: klemmen auf letzten Modell-Frame.

Snow-Anteil (`snowValues`) läuft analog.

### 3) Render-Pfad in `PrecipOverlay`

`redrawRef` bekommt eine neue Verzweigung:

- **Messung** (`currentTMs ≤ nowMs` **und** exakt auf Frame): bestehender `cacheRef`-Pfad — unangetastet.
- **Zwischen zwei Messungen** (Scrub während `t < nowMs`): weiterhin Cache + Alpha-Crossfade (kein Nowcasting rückwärts nötig).
- **Alles nach `nowMs`**: `grid = sampleRadarAt(tMs)` → in `morphCanvasRef` schreiben → `drawImage`.

`morphCanvasRef` wird pro Tick wiederverwendet (1-Slot), kein zusätzlicher Cache-Wachstum. `buildMorphedOffscreen` bleibt als interne Hilfsfunktion, wird aber nur noch vom Sampler aufgerufen.

### 4) Play-Loop und Scrub nutzen gemeinsamen Sampler

`playStepIndices` bleibt bestehen für den **Filmstrip** und das Snapping (echte Frames). Play-Loop wird umgebaut:

- Statt Cursor über `playStepIndices` mit Progress zwischen zwei Indizes, arbeitet der Loop über eine **kontinuierliche `playVisualMs`**:
  - Start: aktuelles `idx` bzw. `nowMs`.
  - Pro Tick: `playVisualMs += dtWall · timeScale(speed)`, wobei `timeScale` so gewählt ist, dass 15 Prognose-Minuten weiter in `FRAME_MS/speed` Wall-Zeit dargestellt werden (identische gefühlte Geschwindigkeit wie heute).
  - Am Ende (`> lastMs`) stoppt Play, wie bisher.
- `setPlayVisualMs(playVisualMs)` steuert die Bubble/Marker wie heute.
- `setPlayCrossfade` entfällt in seiner alten Semantik; stattdessen liest `PrecipOverlay` die aktuelle Zeit direkt via `playVisualMs ?? frames[idx].t` und rendert per Sampler.

**Scrubbing:** der Slider setzt `scrubVisualMs`. `PrecipOverlay` rendert dieselbe Formel `sampleRadarAt(scrubVisualMs)` — dieselbe Kurve, garantiert sprungfrei zwischen zwei Frames.

Die Filmstrip-Klicks rasten wie heute auf echte Frame-Zeiten ein (nur Anzeige/Interaktion, keine Renderpfad-Änderung).

### 5) Performance

- Nowcast-Shift: einmal pro `nowIdx`-Wechsel (≈alle 5 min).
- Forecast-Shifts: bereits im `shiftCacheRef` gecached.
- Sampler produziert nur `lowW × lowH` Werte (heutiges Raster, mobil-tauglich).
- Kein neuer Cache: `morphCanvasRef` als 1-Slot bleibt.
- Mess-Frames rendern weiterhin aus `cacheRef` — kein Zusatzaufwand für die "Messung bleibt unangetastet"-Garantie.

### 6) Was bewusst nicht angefasst wird

- `getRadarFrames`, R2, Server, Ingest, Cache-Struktur der Rohdaten.
- Mess-Renderpfad und -Farben (`colorFor`, Schwellen, Cache).
- Filmstrip-Inhalte, Beschriftungen, Hagel-Layer, `MeasurementCanvasOverlay`.
- `/karten/niederschlag`.

## Verifikation

1. `/karten/radar` Play: Regenzellen wandern kohärent von `nowMs` bis `lastMs`, sichtbar auch in der ersten Nowcast-Stunde (allein aus Radar-Bewegung), und gehen zwischen +60 min und +120 min unmerklich in die Modellprognose über.
2. Scrubben an beliebigen Zeitpunkten (z. B. 14:07, 15:43): stufenlose Darstellung, keine Sprünge an Stundengrenzen.
3. Vor `nowMs`: pixelidentisch zu heute (Messung unverändert).
4. Mobile Throttling Mid-Tier: Play ≥ 30 fps, kein Memory-Sprung.
5. `bunx tsgo --noEmit` grün.

## Technische Stichpunkte

- Datei: `src/components/maps/radar-map.tsx` (einzige Änderung).
- Neue Helfer: `estimateRadarMotion`, `sampleRadarAt` (als innere Funktion in `PrecipOverlay`, mit Zugriff auf `shiftCacheRef`, `motionRef`, `payload`).
- Neue Refs: `motionRef: { vx, vy, baseIdx } | null`, weiterverwendet `shiftCacheRef`, `morphCanvasRef`.
- Konstanten: `T_NOW_MS = 60·60_000`, `T_FADE_MS = 120·60_000`.
- Play-Loop: kontinuierliche `playVisualMs` statt Cursor+Progress.
- Keine neuen Dependencies.
