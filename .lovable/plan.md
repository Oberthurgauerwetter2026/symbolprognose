## Ziel

Im Play-Modus springt die Animation in den jeweils sinnvollen Schritten durch die Zeitachse:

- **Messung (Vergangenheit):** 5-Minuten-Takt (MCH-Raster)
- **Prognose, erste 24 h:** 15-Minuten-Takt
- **Prognose, danach bis +48 h:** 1-Stunden-Takt

Gilt für die Radar-Karte. Wind bleibt unverändert (Modell liefert nur stündliche Frames — 15-min/5-min existieren dort gar nicht).

## Änderungen

### 1) Backend — `src/lib/radar.functions.ts`

Forecast-Schleife liefert aktuell nur stündliche Frames (`tMs += 3600_000`). Anpassung:

- Erste 24 h ab `now`: 15-Minuten-Takt, ausschliesslich aus `minutely_15` (CH1). Falls `minutely_15` für einen Slot fehlt → Slot überspringen (kein Hourly-Fallback im 15-min-Raster, sonst Stufenkanten).
- Danach (24 h … 48 h): stündlich wie heute, mit CH1-Hourly → CH2-Hourly Fallback.
- Bias-Korrektur & Snow/Hail-Logik unverändert, nur an die feinere Auflösung durchgereicht.
- Werte aus `minutely_15.precipitation` sind 15-min-Summen → korrekte Umrechnung auf mm/h (`*4`) bleibt wie heute.

Die Past-Frames (MCH-Manifest, 5-min) werden weiterhin unverändert übernommen.

### 2) Frontend — `src/components/maps/radar-map.tsx`

`hourlyIndices` (Zeilen ~1183–1204) wird durch `playStepIndices` ersetzt, das die Cadence-Regel oben umsetzt:

- Iteriere Frames in Zeit-Reihenfolge.
- Nimm den ersten Frame jeder „Bucket-Grenze":
  - `t <= now`: Bucket = 5 min
  - `now < t <= now + 24 h`: Bucket = 15 min
  - `t > now + 24 h`: Bucket = 60 min
- Dedup auf Frame-Index.

Play-Loop (Zeilen ~1207–1236):

- `nextStep = playStepIndices.find(i => i > cur)` statt `hourlyIndices`.
- `FRAME_MS` (heute `1800/speed` ms pro Hop) bleibt konstant pro Hop — also unabhängig von der realen Bucket-Grösse. Das ergibt natürliches Verhalten: in Forecast „rauscht" die Animation schneller durch (kleinere Zeitsprünge), in der weiteren Zukunft langsamer pro Realzeit, aber gleich schnell pro Klick. (Falls du stattdessen konstante Realzeit-Geschwindigkeit willst → bitte sagen, das wäre eine andere Skalierung.)

Cross-Fade `nextFrame` (Zeilen ~1242–1247): analog auf `playStepIndices` umstellen.

Scrub bleibt wie zuletzt definiert: in Forecast strikt auf Forecast-Frames snappen, in Past 5-min-genau. Mit den neuen 15-min-Forecast-Frames bedeutet das automatisch, dass beim Scrubben in der ersten 24-h-Zone auf 15-min einrastet wird — keine zusätzliche Logik nötig.

### 3) Wind — unverändert

`wind.functions.ts` liefert stündliche Frames, das passt zur User-Aussage „Prognose im 1-h-Takt". Keine Änderung.

## Nicht angefasst

- Farb-Skalen, Overlays, Hail/Snow-Anzeige
- Past-Quelle (MCH), Caching, Ingest-Pipeline
- `speed`-Regler, Slider-UI, Bubble-Label-Snapping (bleibt frame-basiert)
- `wind-map.tsx`, `precip-accum-map.tsx`, `satellite-map.tsx`

## Offen

Wenn du möchtest, dass Play **echte Zeit konstant** abspielt (z. B. „1 h pro Sekunde" — dann wirkt Past extrem schnell und Forecast langsam), sag Bescheid; aktuell plane ich **konstante Hop-Dauer** (jeder Schritt dauert gleich lang, unabhängig davon ob es 5 min, 15 min oder 1 h realer Zeit sind).