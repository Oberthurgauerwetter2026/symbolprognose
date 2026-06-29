## Ziel

Scrubben (und Springen) über die gesamte Zeitachse — Messung wie Prognose — läuft ruckelfrei. Darstellung/Settings (Auflösung, Glättung, Farbskala, Smoothing-Quality, Crossfade) bleiben unverändert.

## Engpässe heute

- **Prognose**: Pre-Warm verarbeitet nur `stripFrames` (Cadence-reduziert). Beim Scrubben über die volle `frames`-Liste werden alle Nicht-Strip-Frames lazy gerendert → kurzes Stocken.
- **Prognose-Cache**: `CACHE_MAX = 256` in `PrecipOverlay` reicht für 48 h × 15-min-Frames (≈192) plus Mess-Grid-Frames knapp.
- **Messung**: `MeasurementCanvasOverlay` decodet jedes PNG erst beim Wechsel der `url`-Prop; LRU `DECODE_CACHE_MAX = 8` → beim Scrubben über 30+ Radarframes werden Decode-Kosten neu fällig.
- Pre-Decode für Radar-PNGs existiert nicht.

## Änderungen — `src/components/maps/radar-map.tsx`

### 1) Prognose: alle Frames vorwärmen, Cache hochziehen

- Pre-Warm-Liste umstellen: an `PrecipOverlay` (Z. 2004) wird `prewarmFrames={frames}` statt `stripFrames` übergeben. `buildOffscreenRef` ignoriert PNG-Frames (kein `values`) ohnehin (`vals.length > 0`-Guard), Mehraufwand betrifft nur Forecast-Frames.
- `CACHE_MAX` (Z. 482) von `256` → `512`. Reicht für alle Forecast-Frames bei aktueller View, kein Re-Render beim Scrubben in beide Richtungen.
- Reset-Verhalten unverändert: bei `movestart/zoomstart/resize` wird der Cache wie bisher geleert und nach Idle erneut vorgewärmt.

### 2) Messung: alle Radar-PNGs vor-decoden

- `MeasurementCanvasOverlay` (Z. 926-) bekommt eine optionale Prop `prefetchUrls?: string[]`.
- Neuer `useEffect` darin: nach Mount/Änderung der Liste werden die URLs über `requestIdleCallback`-Schedule sequenziell als `Image` geladen, in mm/h-Grid decodiert und in `cacheRef` gelegt — gleicher Pfad wie der reguläre `useEffect` für `url`. Abbruch bei Unmount oder Listen-Wechsel über `cancelled`-Flag.
- `DECODE_CACHE_MAX` (Z. 940) von `8` → `96`, deckt ~8 h 5-min-Radar mit Reserve. Kein Bild-Resize, keine Darstellungs-Änderung.
- Aufrufer (Z. 2007): `prefetchUrls={radarUrls}`, wobei `radarUrls = useMemo(() => frames.filter(f => f.source === 'radar' && f.precipUrl).map(f => f.precipUrl!), [frames])`.

### 3) Keine Darstellungs-Änderungen

- `STEP`, `imageSmoothingQuality`, `imageRendering`, `colorFor*`, fbm-Modulation, Crossfade-Logik und Seam-Crossfade bleiben **unverändert**. Nur Cache-Grenzen und Vorwärm-Listen wachsen.

## Verifikation

- `bunx tsgo --noEmit` grün.
- `/karten/radar`: schnelles Scrubben über die gesamte Zeitachse (Messung + Prognose) zeigt sofort den passenden Frame — kein „erst Lade-Flicker, dann Bild". Wiederholtes Hin-und-Her im Slider bleibt flüssig.
- Pan/Zoom invalidiert wie bisher den Cache und wärmt nach kurzer Idle-Pause wieder vor.
