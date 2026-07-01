## Ziel

Der „Stop" beim Übergang letzte Messung → erste Prognose im Filmstrip-Play und beim Scrubbing verschwindet. Statt einer Lücke von bis zu ~15 min zwischen dem letzten Radar-Frame (z. B. 15:35, mit `nowMs` = 15:38) und dem ersten 15-min-Prognoseraster-Punkt (15:45) läuft die Animation kontinuierlich und advektiv über die Grenze hinweg. Die Messung selbst wird visuell nicht verändert.

## Ursache

Zwei Stellen erzwingen aktuell den harten Stop bzw. den optischen Sprung:

1. **`playStepIndices`** in `src/components/maps/radar-map.tsx` (~L2289–2351): Mess-Phase endet auf 5-min-Raster bei `endMeas ≤ nowMs`. Prognose-Phase startet erst am nächsten 15-min-Slot nach `nowMs`. Der Play-Loop hält den Cursor auf dem letzten Mess-Frame, bis das nächste Prognose-Ziel erreicht ist — sichtbar als Standbild.
2. **Render-Guard** in `PrecipOverlay.redraw` (~L855–885): `nowcastActive` verlangt `frame.source !== "radar"`. Solange der Basisframe die letzte Messung ist, greift die Fusion nicht, sondern der klassische Alpha-Crossfade — die Regenzellen springen statt zu wandern.

## Änderungen (nur `src/components/maps/radar-map.tsx`)

### 1) Fusion beginnt exakt bei `nowMs`, unabhängig vom Basisframe

In `redraw` die Bedingung für `nowcastActive` entkoppeln vom `frame.source`:

- Fusion aktiv, sobald `rt > nc.nowMs` **und** `rt < nc.nowMs + T_FADE_MS` **und** `nc.frame.values` vorhanden. Die Modellseite der Fusion darf `nf` sein; ist `nf` noch die letzte Messung (Play sitzt auf endMeas), fällt die Fusion auf reines Nowcasting (`w = 0`) zurück — genau der gewünschte weiche Start.
- `buildFusionOffscreenRef.current(rt, frame, nf, prog, nc)` erhält als „Modell"-Referenz den ersten echten Prognoseframe nach `nc.nowMs`, wenn `frame`/`nf` noch Messung sind. Dazu einen kleinen Helper `findNextForecastFrame(afterMs)` einführen (linear/Bisektion über `frames`), der intern gecached wird.
- Die bestehende Messung-Anzeige bei `rt ≤ nowMs` bleibt exakt wie heute (Cache + Alpha-Crossfade), keine Änderung an `colorFor`, `cacheRef`, Snow-Layer etc.

### 2) Play-Loop überbrückt die Meas→Forecast-Lücke lückenlos

Im Play-Effekt (~L2375–2452) den Cursor-Schritt am Übergang so anpassen, dass die Wall-Zeit zwischen letzter Messung und erstem Prognoseziel konsistent zur Forecast-Cadence bleibt:

- `computeStepWall` erhält eine Sonderbehandlung, falls `aIdx` ein Messframe (`frames[aIdx].source === "radar"`) und `nIdx` ein Prognoseframe ist: statt `gap / REF_GAP_MS` wird `Math.min(gap, REF_GAP_MS) / REF_GAP_MS` verwendet, damit ein 10-min-Übergang nicht künstlich langsamer, aber auch nicht mit `>1`-Faktor gedehnt wird.
- Wichtiger: während dieses Übergangs liefert `emitVisual` bereits die kontinuierliche `playVisualMs`, und `redraw` rendert dank Punkt 1 sofort per Nowcasting-Advektion. Kein zusätzlicher Zwischenframe im Filmstrip nötig — der visuelle Fluss entsteht rein durch die Sampler-basierte Darstellung.
- Zusätzlich: den Sonderfall „nur ein Mess-Frame steht als aIdx, es folgt kein Prognose-Frame direkt danach" abfangen. Wenn zwischen `endMeas` und `startFc15` mehr als ~10 min Lücke liegen, wird im `playStepIndices` **ein zusätzlicher virtueller Übergangsschritt** an `nc.nowMs + 15 min` eingefügt — als reiner Zeitanker, gemappt auf `nowIdx` (letzter Radar-Frame). Der Loop nutzt diesen Anker nur, um `playVisualMs` weiterlaufen zu lassen; das Rendering geht via Fusion. So bleibt die bestehende Struktur (Indizes in `frames`) intakt.

### 3) Scrubbing über die Grenze

Der Slider sendet bereits eine kontinuierliche Zeit an `renderTimeMs`/`playVisualMs`-äquivalent (`FilmstripTimeline` → `snapAndEmit`). Zwei kleine Anpassungen:

- Beim Scrubben in den Bereich `rt > nowMs` nicht auf den letzten Messframe „hart" snappen, sondern `idx` auf den letzten Messframe setzen **und** `renderTimeRef.current = rt` durchreichen. Das ist die Datengrundlage, die Punkt 1 braucht, um advektiv zu rendern.
- `snapAndEmit` bekommt einen weichen Modus während aktiven Draggens: kein Snap auf Cadence-Frames innerhalb der ersten 60 min nach `nowMs`, nur beim Loslassen des Sliders. So wirken beide Übergänge (Play + Scrub) identisch flüssig.

### 4) Nicht angefasst

- `getRadarFrames`, R2, Server, Ingest, Caches der Rohdaten.
- Mess-Renderpfad, Farben, `cacheRef`, Snow/Hagel, `MeasurementCanvasOverlay`.
- `estimateRadarMotion`, `buildFusionOffscreen`, `buildMorphedOffscreen` (Signatur bleibt).
- `/karten/niederschlag`, Embeds.

## Verifikation

1. `/karten/radar` Play: keine Standbild-Pause mehr am Übergang letzter Messung → erster Prognose-Frame; Regenzellen wandern kontinuierlich weiter.
2. Scrubben durch `nowMs`: keine sichtbare Kante, gleiche Bewegung wie im Play.
3. Vor `nowMs`: pixel-identisch zu heute (Messung unverändert, keine Fusion).
4. `bunx tsgo --noEmit` grün.
5. Mobile: FPS im Play weiterhin ≥ 30, keine zusätzlichen Caches.

## Technische Stichpunkte

- Einzige Datei: `src/components/maps/radar-map.tsx`.
- Guard `frame.source !== "radar"` in `nowcastActive` entfernen; stattdessen `rt > nc.nowMs` als Trigger.
- Neuer Helper `findNextForecastFrame(afterMs)` (memoisiert per `useMemo` über `frames`).
- Play-Loop: `computeStepWall` mit Meas→Forecast-Sonderfall; optionaler virtueller Übergangs-Ankerschritt in `playStepIndices`.
- Scrub: kein Cadence-Snap im aktiven Drag innerhalb `[nowMs, nowMs + 60 min]`.
- Keine neuen Dependencies, keine Server-Änderungen.