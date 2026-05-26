## Änderungen

### 1. MCH-Radar-PNG markanter (`src/components/maps/radar-map.tsx`)

`ImageOverlay` für `precipUrl` bekommt eine CSS-Klasse `mch-precip`, dazu in `src/styles.css`:
```css
.mch-precip { filter: saturate(1.5) contrast(1.25); }
```
→ MeteoSchweiz-Messung erscheint mit denselben kräftigen Farben wie der ICON-CH1-Canvas.

### 2. BUFFER auf 3 erhöhen (Canvas-Renderer)

`const BUFFER = 1.5` → `const BUFFER = 3`. Ns wird ~15 km über die Daten-Bbox hinaus per Nearest-Edge extrapoliert (mit Edge-Fade, also ohne Balken-Artefakte).

### 3. Snow-Schwelle senken

`snowFrac > 0.5` → `snowFrac > 0.3`. Schnee-Palette greift früher.

### 4. Farben noch markanter

Im Canvas-Renderer Filter verstärken:
`blur(3px) saturate(1.4) contrast(1.2)` → `blur(2px) saturate(1.7) contrast(1.3)`.

In `SCALE` die unteren 3 Blau-Stufen sattern (statt verwaschen):
- `[150,190,235]` → `[120,180,235]`
- `[130,185,235]` → `[80,160,230]`
- `[90,165,225]`  → `[50,140,220]`

So sind selbst leichte Niederschlagsfelder klar erkennbar — Look entspricht dem Referenz-Screenshot.

### Was unverändert bleibt

See, Aussen-Masken, Hagel-Punkte, Cron-Skripte, Schneefall-Pipeline, Legende-Layout, Layer-Reihenfolge.