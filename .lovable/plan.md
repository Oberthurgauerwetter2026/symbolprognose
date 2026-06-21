## Ziel

In **Prognose-Frames** (und Mess-Frames ohne POH-PNG) sollen automatisch schwarze Hagel-Punkte erscheinen, wo die Niederschlagsintensität ein gewitter-/hageltypisches Niveau erreicht. Optisch gleich wie der bestehende POH-Layer (`.hail-blackdots`).

## Änderungen (nur `src/components/maps/radar-map.tsx`, `CanvasPrecipLayer`/`redrawRef`)

### 1. Hagel-Schwellen aus Intensität ableiten

Nach der bestehenden `v = v * mod`-Modulation (Zeile 522) wird `v` (mm/h, äquivalent zu dBZ-Stufen) gegen zwei Schwellen geprüft:

- `HAIL_LOW = 25 mm/h` → leichte Hagel-Wahrscheinlichkeit
- `HAIL_HIGH = 50 mm/h` → hohe Wahrscheinlichkeit

`hailProb = smoothstep(HAIL_LOW, HAIL_HIGH, v)` → 0..1.

Nur aktiv, wenn `contour === true` (Prognose-/Modell-Frames). Mess-Frames mit echtem `hailUrl` bleiben unverändert; Mess-Frames ohne `hailUrl` bekommen die abgeleiteten Punkte ebenfalls (Flag `useDerivedHail = contour || !frame.hailUrl`).

Nur in den Messungen! Nicht in Prognose

### 2. Punkte zeichnen

Nach `drawImage(off, ...)` (Zeile 568) ein zweiter Pass in voller Canvas-Auflösung:

- Raster ≈ alle **6 CSS-Pixel** (in `dpr`-skaliertem ctx).
- Pro Rasterpunkt: identische Lat/Lng → fx/fy → Sample wie oben; `hailProb` berechnen.
- Deterministischer `hash(ix, iy, seed)` (bereits vorhanden) → wenn `hash < hailProb * 0.55`, einen Punkt setzen.
- Punkt: `ctx.fillStyle = "rgba(0,0,0,0.85)"`, `ctx.beginPath(); ctx.arc(px, py, 1.1, 0, 2π); ctx.fill();`
- Stabil pro Frame (gleicher Seed wie Noise), kein Flackern; Crossfade zwischen Frames via gleichem Seed-Schema.

Hinweis: kein separates Canvas/Overlay — derselbe Layer, nach dem Niederschlag gezeichnet, damit Z-Order konsistent ist (`zIndex 440`, Punkte sichtbar über Farbflächen).

### 3. Toggle wiederverwenden

Sichtbarkeit des abgeleiteten Hagels über bestehenden `showHail`-State. Dafür `showHail` als Prop in `CanvasPrecipLayer` reinreichen (aktuell nicht vorhanden) und nur dann den Dot-Pass laufen lassen. `data.hasHail` im Reducer auf `true` setzen, sobald irgendein Mess-ODER Forecast-Frame existiert (damit das UI-Toggle nicht disabled bleibt) — kleinste Anpassung in `radar.functions.ts` (`hasHail = hasRealRadar || forecast vorhanden`).

### 4. Legende

`"Hagel (POH)"` → `"Hagel (POH / abgeleitet bei Gewitter)"` im Tooltip-Text. Legenden-Punkte und Farbskala unverändert.

## Nicht enthalten

- Keine neuen Datenquellen / API-Calls.
- Keine Änderung des Forecast-Farbschemas, der Konturen, der Noise-Parameter.
- Kein neuer Layer-Komponententyp.