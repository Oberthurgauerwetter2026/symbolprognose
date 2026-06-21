# Satellit: Ladezeit kürzen + Timeline wie Radar/Wind

## 1. Warum Meteociel so scharf ist
- Layer-Auflösung: `mtg_hrfi:*` (HRFI, ~1 km / 500 m) statt Full-Disc (2 km). Bereits umgestellt.
- Pre-rendering: Meteociel rendert PNG-Sequenzen serverseitig; wir nutzen WMS live.
- Tile-Größe: 512 px Kacheln statt 256. Bereits umgestellt.

Sichtbar scharf ist es jetzt — die Ladezeit kommt von PNG bei 512.

## 2. Ladezeit reduzieren (ohne Schärfe-Verlust)

### `src/components/maps/satellite-map.tsx` (`FrameStack`)
- **`format: "image/jpeg"`** statt PNG. JPEG-Q ist bei EUMETView Standard ~85, visuell identisch zu PNG bei Satelliten-Imagery (keine harten Kanten/Text), aber **~5–8× kleinere Tiles**.
- **Priorisiertes Laden**: aktiver Frame zuerst, dann radial nach außen. Statt alle 30 WMS-Layer gleichzeitig zu mounten:
  - Phase 1: nur `activeIndex` mounten → User sieht sofort ein Bild
  - Phase 2: setTimeout 100ms — alle anderen Frames mounten (sequentiell der Reihenfolge nach: `activeIndex+1, -1, +2, -2, …`)
  - `Auto-Play startet ab 80% loaded` bleibt
- **`updateWhenZooming: false`** und **`keepBuffer: 0`** an WMS-Optionen → keine Tile-Requests während Pan/Zoom-Animationen, kein doppelter Buffer-Rand.

### `src/lib/satellite.functions.ts`
- **HRFI-Regions (`alpen-ch`, `europa-geocolour`, `europa-ir`): Zeitfenster 3 h statt 5 h**, Step bleibt 10 / 15 min → 18 statt 30 Frames für Alpen, 12 statt 20 für Europa.
- `global-ir` (Übersichts-Loop) bleibt bei 5 h.

## 3. Timeline wie bei Radar/Wind

Ersetze den shadcn-`Slider` im Satellit-Map durch eine eigene `SatelliteTimeline`-Komponente, optisch und verhaltenstechnisch identisch zur `MeteoTimeline` in `radar-map.tsx`:

- 4 px Track, brand-farbiger Fill für den **vergangenen** Bereich (nicht Vorhersage, da Satellit nur Vergangenheit zeigt)
- Pointer-Drag mit `requestAnimationFrame`-Throttling und `setPointerCapture`
- ArrowLeft/ArrowRight Tastatur-Support
- "Jetzt"-Marker am rechten Rand (immer = letzter Frame, oder bei `global-ir` evtl. nicht ganz rechts wenn latency > step)
- Stunden-Ticks im Track, Stunden-Labels über dem Track (auf Mobile nur alle 3 h)
- Tages-Labels unter dem Track (z. B. „So, 21.06.2026")
- Brand-farbige Bubble am Handle: `HH:MM` (statt „Messung/Prognose")

Speed-Select und Play/Pause/Skip-Buttons bleiben unverändert. Region-Auswahl + Vollbild + Quellen-Badge bleiben unverändert.

## Was bleibt
- Datenquelle EUMETView WMS, keine neuen APIs/Secrets
- Frame-Stack-Architektur (Opacity-Toggle ohne Flackern)
- Auto-Fallback auf `mtg_fd:*` bei `tileerror`
- `karten.satellit.tsx`, `embed.satellit.tsx`, `maps-config.ts`

## Erwartetes Ergebnis
- **First Paint**: aktiver Frame nach ~300–600 ms sichtbar (statt warten auf alle 30)
- **Auto-Play-Start**: ~3–5 s statt 15–25 s
- **Schärfe**: unverändert (JPEG-Q85 bei 512 px ist visuell = PNG)
- **Timeline**: konsistentes Look & Feel mit Radar/Niederschlag/Wind

## Out of Scope
- Konsolen-Duplikat-Keys für „Neuhof / Riedern / Sonnenberg / Waldegg" stammen aus einer Orts-Liste (nicht aus dem Satellit-Code) und werden hier nicht angefasst.
