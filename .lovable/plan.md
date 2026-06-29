## Problem

Der Filmstrip-Slider zeigt aktuell alle Roh-Frames (5 min für MCH-Messung, 15 min für ICON-CH1, aber zusätzliche 1-min-Zwischenframes von Nowcast/Open-Meteo). Der Play-Loop läuft schon im geforderten Takt (5 / 15 / 60 min), aber die Anzeige nicht — Bubble springt auch zwischen Nicht-Play-Frames.

## Lösung

Den Filmstrip ausschliesslich auf die `playStepIndices`-Frames reduzieren, sodass Slider-Snap, Bubble, „Prev/Next“-Buttons und Drag-Snap genau im gleichen Takt arbeiten wie Play.

### Änderung in `src/components/maps/radar-map.tsx`

- Neu in der Komponente: `stripFrames = playStepIndices.map((i) => frames[i])` (memoisiert).
- `idx → stripIdx`: nächstgelegener Eintrag aus `playStepIndices` (analog `stepCursorForIndex`).
- `<FilmstripTimeline frames={stripFrames} idx={stripIdx} visualNextIdx={…} onChange={(i) => setIdx(playStepIndices[i])} />`.
- „Prev“/„Next“-Buttons (Zeilen ~1903–1913 sowie der entsprechende Prev-Button darüber) bewegen sich entlang `playStepIndices` statt `frames`.
- „Jetzt“-Button springt auf den `playStepIndices`-Eintrag, der `nowIdx` am nächsten ist.

Keine Änderung an `FilmstripTimeline` selbst nötig — sie bekommt einfach das reduzierte Frame-Array.

## Verifikation

- `bunx tsgo --noEmit`
- Preview `/karten/radar`: Bubble/Slider rasten in der Vergangenheit auf 5-min-Schritte, ab jetzt auf 15-min-Schritte, ab +24 h auf 1-h-Schritte. Prev/Next folgen dem gleichen Takt.

## Geänderte Dateien

- `src/components/maps/radar-map.tsx`
