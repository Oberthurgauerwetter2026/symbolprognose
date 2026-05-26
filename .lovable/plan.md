Korrekturen in `src/components/maps/radar-map.tsx` (+ kleiner Eintrag in `src/styles.css`):

1. **See & Aussen-Masken zurück auf Original-Optik**
   - `LAKE`: wieder mit Fill — `color: "#6bb6d6", weight: 0.6, fillColor: "#7ec8e3", fillOpacity: 1`.
   - `OUTSIDE_CH_MASK.fillOpacity`: 0.15 → **0.4**.
   - `OUTSIDE_MASK.fillOpacity`: 0.05 → **0.18**.
   - JSX-Reihenfolge bleibt so, dass `PrecipOverlay` / `ImageOverlay` **über** See und Masken liegen. Der See sieht wieder aus wie früher; wo Niederschlag fällt, deckt das Signal den See ab.

2. **Niederschlag bis an den Karten-Rand zeichnen**
   - In `PrecipOverlay.redraw()` die Pixel-Bounds nicht mehr auf die projizierten Grid-Ecken beschränken, sondern den ganzen Viewport zeichnen (`minX=0, maxX=size.x, minY=0, maxY=size.y`).
   - `fx`/`fy` mit `clamp(0, n-1)` auf die Grid-Ränder klampfen → Nearest-Edge-Extrapolation um die ~5 km bis zum Karten-Rand.

3. **Kontrast bleibt** wie zuletzt (Canvas-`opacity 0.9`, satterer Verlauf, `STEP=2`, Alpha-Start 0.7).

4. **Hagel im Nowcast als schwarze Punkte**
   - `ImageOverlay` für `hailUrl` bekommt `className="hail-blackdots"` und `opacity={0.95}`.
   - In `src/styles.css` neue Regel: `.hail-blackdots { filter: brightness(0) saturate(100%); }` — färbt alle nicht-transparenten Pixel des POH-PNG schwarz, Alpha bleibt erhalten.

Keine Änderungen an `radar.functions.ts`, Cron, Bbox oder Legende.