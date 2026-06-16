## Ziel

Die Radarmessung soll wie das klassische MeteoSchweiz-CombiPrecip-Bild wirken:
sichtbares 1km-Raster, harte diskrete Farbbänder, zusammenhängende
Niederschlagsfelder mit eingebetteten Intensitätskernen — kein weichgezeichneter
Heatmap-Look. Render-Pfad bleibt der bestehende PNG-Ingest, Farbskala bleibt das
volle MCH-Spektrum (Hellblau → Blau → Grün → Gelb → Orange → Rot → Violett).

## Änderungen

### 1. `scripts/ingest_radar.py` — native Rastergrösse

- `OUT_W, OUT_H` von **1024×768** auf **~native CombiPrecip 1km-Auflösung** der
  Bbox reduzieren: ca. **240×144** (entspricht ≈1 km/Pixel im Bereich
  8.15°–10.55° E × 46.85°–48.30° N). Sampling bleibt Nearest-Neighbor in
  `sample_to_bbox`, dadurch entstehen die typischen quadratischen MCH-Zellen.
- `PRECIP_SCALE` unverändert (Farben + Schwellen sind bereits korrekt).
- `EXPECTED_RADAR_INGEST_VERSION` in `.github/workflows/radar-ingest.yml` und
  Skript-`RADAR_INGEST_VERSION` auf neuen String bumpen (`v22-native-raster`),
  damit der Cron-Worker die alten gecachten PNGs überschreibt.

### 2. `src/styles.css` — `.mch-precip` pixelig statt geglättet

```css
.mch-precip {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  filter: contrast(1.1);   /* leichter Kontrast-Lift, kein Blur mehr */
}
```

Der bisherige `blur(0.8px) contrast(2.2)`-Filter wird entfernt — er war für die
1024×768-Version gedacht und hätte das native Raster sofort verwischt.

### 3. Keine Frontend-Logik-Änderungen

`radar-map.tsx`, `radar.functions.ts` und die Prognose-Pipeline bleiben
unverändert. Forecast-Frames (Canvas) sind bereits `pixelated` gerendert, damit
ist Messung↔Prognose visuell konsistent (gleiche Pixelgrösse-Anmutung, gleiche
Farbskala, gleiche Banding).

## Was bewusst NICHT geändert wird

- Kein fraktales Noise auf der Messung — echte CombiPrecip-Daten bleiben
  unverfälscht. Die "zusammenhängenden Felder mit Intensitätskernen" ergeben
  sich automatisch aus dem echten Radarbild.
- Keine Umstellung auf reine Blaustufen — User-Wahl ist MCH-Vollspektrum.
- Keine Hybrid-Canvas-Schicht über dem PNG.

## Verifikation

1. Nächster `radar-ingest`-Run lädt neue PNGs in nativer Auflösung hoch (Logs:
   `OUT_W=240 OUT_H=144`).
2. Im Browser bei Zoom 11–13 sind die Niederschlagszellen als scharfe Quadrate
   sichtbar — wie auf meteoschweiz.ch/Niederschlagsradar.
3. Übergang Messung → Forecast bleibt nahtlos (gleiches Farbschema).
