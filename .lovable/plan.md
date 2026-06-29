## Plan

### 1) Mess-Daten-Lücken in der Vergangenheit füllen (kein Crossfade/Blur)

Wenn ein Past-Frame keine Messung hat (CombiPrecip-PNG fehlt, oder Frame liegt zwischen zwei verfügbaren Messungen), darf der Layer nicht einfach leer bleiben. Lösung im `RadarMap`-Render-Block:

- Wenn `currentFrame.precipUrl` fehlt aber das Frame in der Vergangenheit liegt, das nächstgelegene Frame mit `precipUrl` finden (`findNearestMeasurement(frames, idx)`), und dessen PNG via `MeasurementCanvasOverlay` zeigen — gleiche Komponente, gleiche `colorFor`-Bänder, also exakt dieselbe Optik wie die übrigen Messungen.
- Kein Alpha-Blend, kein Cross-Fade, kein Glätten — der Layer wird ohne Übergangs-Animation hart auf das neue PNG gesetzt (`MeasurementCanvasOverlay` re-mountet pro Quell-URL, `imageSmoothingEnabled = false` bleibt).
- Für reine Forecast-Frames ohne Grid wird wie bisher `PrecipOverlay` mit harten Bändern gerendert; nichts ändert sich an der Forecast-Optik.

### 2) Nahtloser Übergang Messung → Prognose

- `playStepIndices` bekommt einen expliziten "Übergangs-Frame" am Zeitpunkt `nowIdx`, damit der letzte Past-Step und der erste Forecast-Step kein Loch in der Cadence haben.
- Im `FilmstripTimeline.snapAndEmit` wird die Bedingung `restrictForecast` entfernt: Scrubben darf nahtlos Frames beider Quellen treffen, statt beim Überqueren der "Jetzt"-Linie zu springen.
- Der Play-Loop stoppt am Forecast-Ende (gut so), läuft aber durch `nowMs` ohne Pause.

### 3) Flüssigeres Scrubben und Animieren

- `MeasurementCanvasOverlay` cached das zuletzt dekodierte mm/h-Grid nach Quell-URL (kleiner LRU, max 8 Einträge) — beim Zurück-Scrubben auf bereits gesehene Past-Frames entfällt der PNG-Decode.
- Im Scrub-Pfad (`onPointerMove`) wird `snapAndEmit` per `requestAnimationFrame` gedrosselt (ein Snap pro Frame statt pro Pointer-Event), damit React nicht pro Maus-Sample re-rendert.
- `redraw()` in `MeasurementCanvasOverlay` und `PrecipOverlay` läuft ebenfalls über einen RAF-Coalescer, sodass mehrere `moveend`/Frame-Wechsel im selben Tick zu einem Repaint zusammenfallen.
- Auf Desktop bleibt die Bubble-Animation (`playMs`) in `FilmstripTimeline` über RAF; zusätzlich wird `containerW` aus der ResizeObserver-Schleife nur noch bei echten Größenänderungen gesetzt.

### 4) Banner "Modellprognose" konsistent blau

In `sourceLabel()` den Fallback für `icon-ch2` von `#7a4ca0` auf `BRAND` (`#2561a1`) ändern. Sowohl `icon-ch1` als auch `icon-ch2` zeigen damit ein blaues Banner; das violett verschwindet vollständig.

### 5) "Jetzt"-Button

Neuer kleiner Button in der Steuerleiste (`absolute inset-x-2 bottom-2 …`), zwischen Play/Pause und der Filmstrip-Spur sichtbar (Desktop und Mobile). Klick:

- `setPlaying(false)`
- `setIdx(nowIdx)` — nutzt den vorhandenen `useNowFrameIndex`
- Disabled-Zustand, wenn `idx === nowIdx`

Label: "Jetzt" mit `Clock`-Icon (Lucide). Optisch wie die runden Sekundär-Buttons (Prev/Next), aber breiter (z. B. `px-3 h-9`).

### Technische Details

Dateien: nur `src/components/maps/radar-map.tsx`.

- `MeasurementCanvasOverlay`: neuer Prop `decodeKey` = Quell-URL; internes `Map<string, {w,h,mmh}>` mit FIFO-Cleanup bei > 8 Einträgen.
- Neue Hilfsfunktion `pickMeasurementUrl(frames, idx, nowMs): string | null` direkt vor dem Render-Block.
- `FilmstripTimeline.snapAndEmit`: `restrictForecast`-Zweig entfernen, dafür `rafPendingRef` zum Throttlen einbauen.
- `sourceLabel`: Farb-Konstante anpassen.
- Neuer Button im Control-Bar zwischen Play und Prev (Desktop) bzw. neben Play (Mobile).

### Validierung

- `/karten/radar` desktop: in die Vergangenheit scrubben → Niederschlagsfelder bleiben sichtbar, keine Lücke, keine Weichzeichnung.
- Übergang Messung↔Prognose: visuell ein durchgehender Strom, Bubble läuft ohne Stop durch.
- Auto-Play 2×/5×/10×: keine sichtbaren Ruckler (Desktop Chrome/Safari).
- Banner: "Modellprognose" immer blau, kein violett.
- "Jetzt"-Button: nach manuellem Scrub einmal klicken → springt zurück, Button wird disabled.
