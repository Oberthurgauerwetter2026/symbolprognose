# Niederschlagsradar: einheitlicher 5-Minuten-Takt im Filmstrip

## Problem

Der Filmstrip rastet immer auf einen echten Datenframe ein. In der Messung liegen diese alle 5 Minuten, in der Prognose nur alle 15 Minuten (im ICON-CH2-Fallback sogar stündlich). Beim Scrubben durch den Prognoseteil springt die Zeit deshalb in groben Stufen, und zwischen den Stufen "passiert nichts" — obwohl die Kartenanzeige technisch längst zwischen zwei Frames interpolieren kann.

## Lösung

Die Zeitachse wird von der Frameliste entkoppelt: der Filmstrip bekommt ein durchgehendes 5-Minuten-Raster über den gesamten Zeitraum (Messung *und* Prognose). Punkte im Prognoseteil, für die kein eigenes Bild existiert, werden aus den beiden umliegenden Prognosebildern interpoliert — genau derselbe Mechanismus, der schon beim Abspielen für den weichen Übergang sorgt.

Ergebnis:
- Gleichmässiges Scrubben ohne Sprünge, egal ob Messung oder Prognose.
- Bubble-Zeit läuft in 5-Minuten-Schritten durch (10:05, 10:10, 10:15 …).
- Optik unverändert: Farbskala, Bildschärfe und Mess-/Prognose-Band bleiben wie heute; im Prognosebereich sieht man weiche Zwischenzustände statt Standbilder.
- Beim Abspielen bleibt das Tempo wie gewohnt.

## Technische Details

- `src/components/maps/radar-map.tsx`
  - `playStepIndices` (Indexliste auf `frames`) wird durch `timelineSteps: number[]` ersetzt — Zeitstempel in ms auf einem 5-min-Raster von `firstMs` bis `lastMs`. Messpunkte werden weiterhin auf den nächstgelegenen echten Radarframe gesnappt (Toleranz 2.5 min), Prognosepunkte bleiben virtuelle Zeitpunkte.
  - `FilmstripTimeline` erhält `frames={timelineSteps.map(ms => ({ ms }))}`; `idx` wird über den Cursor im Raster geführt statt über den Frame-Index. `onChange(i)` setzt `renderMs = timelineSteps[i]`.
  - Rendering läuft unverändert über `timelineStateForMs(frames, renderMs)`, das `frame`/`nextFrame`/`progress` liefert; der Canvas-/Image-Layer interpoliert damit bereits.
  - `nowIdx`/`stripNowIdx` und Labels (Messung/Prognose, Farbe) werden aus `renderMs` im Vergleich zu `Date.now()` bestimmt statt aus `frame.source`, damit virtuelle Punkte korrekt eingeordnet sind.
  - Play-Loop: `REF_GAP_MS` bleibt Referenz, Start-/Endpunkte kommen aus `timelineSteps`; State-Flush-Drosselung (`FLUSH_MS`) wird auf ~60 ms gesenkt, weil sich die Karte im Prognoseteil nun kontinuierlich verändert.
  - Der ICON-CH2-Fallback (stündlich) profitiert automatisch: dort werden 5-min-Punkte zwischen den Stundenbildern interpoliert.
- `src/components/maps/filmstrip-timeline.tsx` bleibt unverändert (arbeitet schon rein auf `ms`).
- Kein Backend-/Ingest-Eingriff; keine zusätzlichen Bilder nötig.
