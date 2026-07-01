# Plan: Nahtloser Übergang Messung → Prognose

## Problem

Beim Play bleibt die Animation an der Grenze zwischen letztem Radar-Frame und erstem Prognose-Frame hängen: ein sichtbares "Stocken", danach springt das Bild in die Fusion. Ursachen im aktuellen `PrecipOverlay` / Play-Loop:

1. `nowcastActive` verlangt `frame.source !== "radar"`. Solange der Play-Cursor noch auf dem letzten Messungs-Frame steht, läuft die Fusion nicht — der Renderer zeigt nur den statischen letzten Radar-Frame, obwohl `playVisualMs` bereits über `nowMs` hinausgelaufen ist.
2. Der Cursor-Schritt von letzter Messung (z. B. 14:00) zum ersten Forecast-Slot (z. B. 15:00) wird als ein einzelner Step gerendert. Erst mit Cursor-Sprung wechselt der Renderpfad von Cache-Alpha auf Fusion → sichtbarer Jump.
3. `computeStepWall` skaliert die Dauer proportional zur Zeitlücke; die Grenzlücke ist überproportional lang, was das Stocken zusätzlich betont.

## Ziel

Der Übergang von der letzten Messung in die Nowcast-Advektion und weiter in die Modellfusion ist optisch und zeitlich stufenlos — sowohl beim Play als auch beim Scrubben. Die Messung selbst (Rendering für `t ≤ nowMs`) bleibt bit-identisch.

## Änderungen (nur `src/components/maps/radar-map.tsx`)

### 1) Fusion darf am letzten Messungs-Frame ansetzen

In `redrawRef` (Zeilen ~849–908) den `nowcastActive`-Guard so umschreiben, dass er **nicht mehr an `frame.source !== "radar"` gekoppelt ist**, sondern rein an `rt >= nc.nowMs`:

- Wenn `rt >= nc.nowMs` und `nc.frame.values` vorhanden: Fusion-Sampler zeichnen. Als Basis-Frame nutzt der Sampler immer `nc.frame` (letzter Radar-Frame) — der aktuelle `frame` aus dem Cursor spielt für das Rendering ab `nowMs` keine Rolle mehr.
- Bei `rt === nc.nowMs` liefert der Sampler pixel-identisch das letzte Radar-Grid (Advektionszeit 0, Fusion-Gewicht 0). Damit ist der Übergang stetig.
- Vor `rt < nc.nowMs`: bestehender Mess-Pfad (Cache + optionaler Alpha-Crossfade zwischen zwei Messungen) unverändert.

`buildFusionOffscreenRef` unterstützt bereits `renderTimeMs`, `nc.frame`, `nc.vx/vy`; kein Signatur-Change nötig. Nur Sicherstellen, dass `nf` (nächster Modell-Frame) auch dann korrekt gewählt wird, wenn der Cursor noch auf einem Radar-Frame steht — dazu im Overlay den nächsten Nicht-Radar-Frame aus `frames` bestimmen (siehe Punkt 3).

### 2) Playbar-Zeit läuft kontinuierlich über `nowMs`

Im Play-Loop (Zeilen ~2375–2452) den Grenzschritt entkoppeln:

- `computeStepWall` bekommt eine Sonder­behandlung: Wenn `aFrame.t === endMeasFrame.t` **und** `nFrame.t === firstForecastFrame.t`, wird die Wall-Dauer auf `FRAME_MS · gap/REF_GAP_MS` gedeckelt (obere Grenze z. B. `FRAME_MS · 2`), damit die Grenzlücke nicht künstlich lang wirkt. Untergrenze bleibt `0.15 · FRAME_MS`.
- `playVisualMs` läuft während dieses Schritts weiterhin linear von `aMs` → `nMs`. Da der Renderpfad ab `rt > nc.nowMs` (siehe 1) durchgängig die Fusion nutzt, sieht der User eine kontinuierliche Bewegung des Radars ins Nowcasting hinein — kein Wechsel des Bild-Ursprungs.
- `setPlayCrossfade(null)` setzen, sobald `playVisualMs > nc.nowMs`. Der bestehende `playCrossfade`-Zweig in JSX (Zeile ~2625) ist ohnehin nur für Nicht-Radar-Frames aktiv; durch das Nullen wird ein irrtümlicher zweiter Layer über dem Fusion-Bild ausgeschlossen.

### 3) Fusion kennt den nächsten Modell-Frame auch am Rand

In `PrecipOverlay` neben `nextFrameRef` einen `nextForecastFrameRef` einführen, den der Renderer für Fusion nutzt, wenn der Cursor noch auf `radar` steht. Berechnung:

- Beim Update von `frame`/`nextFrame`: wenn `nextFrame?.source === "radar"` oder null, suche vorwärts in `frames` den ersten Frame mit `source !== "radar"` und `Date.parse(t) > nc.nowMs`; speichere in `nextForecastFrameRef`.
- `buildFusionOffscreenRef` erhält beim Aufruf `nextForecastFrameRef.current ?? nf` als "nf"-Argument. So kann die Modell-Komponente der Fusion selbst am Grenzschritt schon leicht anteilig einfließen (Progress im Fusion-Sampler bleibt allein durch `rt`/`T_FADE_MS` bestimmt).

### 4) Scrubbing

Da Scrubbing bereits `renderTimeMs = playVisualMs ?? Date.parse(currentFrame.t)` an das Overlay übergibt und die Fusion jetzt an `rt >= nc.nowMs` gebunden ist statt an `frame.source`, ist Scrubben über die Grenze hinweg automatisch stetig — kein zusätzlicher Code.

## Was ausdrücklich unverändert bleibt

- `getRadarFrames`, R2, Server, Ingest, Cache-Struktur.
- `colorFor`, Schwellen, Mess-Rendering für `rt ≤ nc.nowMs` (Cache + Alpha).
- Filmstrip-Cadence, Hagel-Layer, `MeasurementCanvasOverlay`.
- Keine neuen Dependencies, keine Server-Änderungen.

## Verifikation

1. Play von einem Zeitpunkt vor `nowMs` durchspielen: Bewegung der Regenzellen läuft ohne Ruckler oder Bildwechsel über die `nowMs`-Grenze ins Nowcasting.
2. Scrubben genau an `nowMs ± 30 s` zeigt stufenlose Interpolation.
3. Rendering für `t ≤ nowMs` ist pixel-identisch zu vorher (Screenshot-Vergleich am letzten Radar-Frame).
4. `bunx tsgo --noEmit` grün.

## Technische Stichpunkte

- Datei: `src/components/maps/radar-map.tsx`.
- Refs neu: `nextForecastFrameRef`.
- Angepasst: `nowcastActive`-Bedingung, Fusion-Aufruf verwendet `nc.frame` als Basis und `nextForecastFrameRef` als Modell-Partner, Play-Loop cap für Grenzschritt.
