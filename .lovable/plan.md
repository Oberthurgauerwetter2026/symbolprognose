## Ziel

Die Timeline-Komponenten in `satellite-map.tsx` (`SatelliteTimeline`) und `wind-map.tsx` (`WindTimeline`) werden durch denselben scrollenden Filmstreifen ersetzt, der beim Niederschlagsradar (`FilmstripTimeline` in `radar-map.tsx`) verwendet wird — inkl. Bubble mit Pfeil, Mittellinie, Stunden-/10-min-Ticks, Tageswechsel-Marker und Messungs-/Prognose-Band.

## Umsetzung

### 1. Gemeinsame Komponente extrahieren
Neue Datei `src/components/maps/filmstrip-timeline.tsx` mit generischer Version der Radar-`FilmstripTimeline`. Props:

```text
frames:        { ms: number }[]          // Zeitpunkte in ms
idx:           number
onChange:      (i: number) => void
isMobile:      boolean
playing?:      boolean                    // default false
visualMs?:     number | null              // kontinuierliche Zeit für Bubble/Marker
onScrubMs?:    (ms: number | null) => void
color:         string                    // Timeline-Akzentfarbe (Bubble, Fokus-Ring, Diamant)
bandMode:      "measurement-forecast" | "measurement-only" | "forecast-only"
bandColors?:   { measurement?: string; forecast?: string }
formatBubble:  (d: Date) => string
ariaLabel:     string
```

Verhalten identisch zur bestehenden `FilmstripTimeline` (scrollender Strip mit `translate3d`, fixe Mittellinie, Bubble oben, Drag-Scrub mit rAF-Coalescing, Keyboard-Support). Der `nowMs`-Split für Messungs-/Prognose-Band wird über `bandMode` gesteuert:
- `measurement-forecast` (Radar): grau bis `nowMs`, blau danach.
- `measurement-only` (Satellit): grau über die ganze Länge, kein Prognose-Band.
- `forecast-only` (Wind): blau über die ganze Länge, kein Messungs-Band.

### 2. Radar auf die neue Komponente umstellen
`radar-map.tsx`: interne `FilmstripTimeline`-Definition entfernen, stattdessen die neue Komponente importieren. Radar-spezifische Bubble-Farbe (`timelineColorFor(currentFrame)`) und Bubble-Text (`fmtBubble(date, frame)` mit „Messung"/„Prognose"-Präfix) werden im Radar-Aufrufer über `color`/`formatBubble`-Props gesetzt. `bandMode="measurement-forecast"`. Verhalten bleibt bit-genau (kontinuierliches `visualMs`, `onScrubMs`).

### 3. Satellit umstellen
`satellite-map.tsx`: `SatelliteTimeline`-Komponente (Zeilen 187–~380) entfernen. Aufrufer verwendet die neue Komponente mit:
- `frames = satelliteFrames.map(f => ({ ms: Date.parse(f.time) }))`
- `color = BRAND` (`#2561a1`)
- `bandMode = "measurement-only"`
- `formatBubble = fmtBubble` (bestehend, „Wd, HH:MM")
- `ariaLabel = "Satellit-Zeit"`
- kein `visualMs`/`onScrubMs` (Satellit spielt Frame-für-Frame).

### 4. Wind umstellen
`wind-map.tsx`: `WindTimeline`-Komponente (Zeilen 963–~1130) entfernen. Aufrufer verwendet die neue Komponente mit:
- `frames = windFrames.map(f => ({ ms: Date.parse(f.t) }))`
- `color = BRAND`
- `bandMode = "forecast-only"`
- `formatBubble = fmtBubble` (bestehend, „Prognose: Wd, HH:MM")
- `ariaLabel = "Windprognose-Zeit"`

### 5. Was NICHT geändert wird
- Play-/Scrub-Logik im Radar (`renderMsRef`, throttle, Seam-Behandlung) bleibt vollständig erhalten.
- Datenquellen (`radar.functions.ts`, `satellite.functions.ts`, `wind.functions.ts`) unangetastet.
- Karten-Overlays, Farben, Advektion, Wind-Rendering bleiben unverändert.
- Play/Pause-Buttons, Speed-Auswahl, Hail-Toggle etc. bleiben in den jeweiligen Maps.

## Betroffene Dateien
- `src/components/maps/filmstrip-timeline.tsx` (neu)
- `src/components/maps/radar-map.tsx` (interne Timeline entfernen, neue importieren)
- `src/components/maps/satellite-map.tsx` (Timeline ersetzen)
- `src/components/maps/wind-map.tsx` (Timeline ersetzen)

## Verifikation
- `bunx tsgo --noEmit`.
- Preview /karten/satellit und /karten/wind: Filmstrip wird angezeigt, Drag-Scrub aktualisiert Frame, Keyboard-Pfeile funktionieren, Bubble zeigt korrektes Label.
- Preview /karten/radar: Verhalten (Play/Scrub, Seam, Bänder) unverändert.
