# Wind-Advection für ICON-CH1-Prognose

Messung (MeteoSchweiz-PNGs, R2-Manifest, Ingest) bleibt komplett unangetastet. Änderungen ausschließlich im Prognose-Pfad von `src/lib/radar.functions.ts`.

## Verfahren

Semi-Lagrangian Advection zwischen je zwei stündlichen ICON-CH1-Ankern A (t=0) und B (t=60 min). Für jeden 15-min-Frame mit α = Δt/60:

- `A_fwd = advect(A, uA, vA, +α·3600 s)` — Anker A entlang Wind(A) vorwärts verschoben
- `B_bwd = advect(B, uB, vB, −(1−α)·3600 s)` — Anker B entlang Wind(B) rückwärts verschoben
- Frame-Wert = `(1−α) · A_fwd + α · B_bwd`

Zellen wandern sichtbar von A nach B; Intensitäts­änderungen über den Blend. Bei Wind ≈ 0 fällt das automatisch auf einen reinen Crossfade zurück.

`advect(field, u, v, dt)` arbeitet pro Ziel-Gridpunkt mit Backward-Lookup:
- Quelle (lat, lon) = (lat − v·dt/111000, lon − u·dt/(111000·cos(lat)))
- bilineares Sampling der vier Nachbarn im 36×22-Grid
- Out-of-bbox → 0

Aufwand: ein bilinearer Pass pro 15-min-Frame über 36×22 ≈ 800 Punkte — vernachlässigbar.

## Konkrete Änderungen — nur `src/lib/radar.functions.ts`

### 1. `LocResponse.hourly` erweitern
`wind_speed_700hPa: (number|null)[]`, `wind_direction_700hPa: (number|null)[]` ergänzen. Wird vom Ingest schon geliefert.

### 2. Stündliche Anker als 2D-Felder formen
Innerhalb des bestehenden Forecast-Blocks (ab Zeile ~309):
- Aus `minutely_15.time` die Stunden-Indizes ermitteln (jeweils erstes 15-min-Sample pro Stunde).
- Aus `hourly.time` die zugehörigen Wind-Indizes mappen.
- Für jeden Stunden-Anker: 2D-Felder `precipHour[GRID_LAT][GRID_LON]` (mm/h), `snowHour[...]`, `uHour[...]`, `vHour[...]` aus `r1[pi]` aufbauen.
- Wind-Umrechnung met → kart.: `u = -speed · sin(dir·π/180)`, `v = -speed · cos(dir·π/180)` (Open-Meteo `wind_direction` = Herkunftsrichtung).
- `speed` von km/h in m/s teilen (Open-Meteo Default ist km/h).

### 3. Advection-Kernel
Reine Helper-Funktion (Modul-Scope, oberhalb des Handlers):

```text
function advect(field, u, v, dtSeconds, lats, lons): number[][]
```
- Iteriert über alle Ziel-Gitterpunkte (lat[i], lon[j]).
- Berechnet Quelle, sampelt bilinear, schreibt ins Output-Grid.
- Verwendet die u/v-Felder am Ziel-Punkt (Standard semi-Lagrangian Approx).

### 4. Frame-Schleife umbauen
Pro 15-min-Frame zwischen now und now+24 h:
- Anker-Index a finden (letzter Stundenanker ≤ tMs), α berechnen.
- `A_fwd = advect(precipHour[a], uHour[a], vHour[a], +α·3600, ...)`.
- `B_bwd = advect(precipHour[a+1], uHour[a+1], vHour[a+1], −(1−α)·3600, ...)`.
- Per Ziel-Pixel: `value = ((1−α)·A_fwd + α·B_bwd) · biasCorrection`.
- Schnee analog mit denselben u/v.
- Letzter Stunden­anker (a+1 nicht vorhanden) → reines `A` ohne Advection.

### 5. Alten Pfad entfernen
`buildSmoothSeries` + die per-Punkt-Zeitreihen werden entfernt — durch Advection ersetzt. Bias-Korrektur (`biasFactor`, `BIAS_FADE_MIN`) und alle anderen Schritte bleiben unverändert.

## Nicht angefasst

- MeteoSchweiz-Messpfad (PNGs, R2-Manifest, `past_minutely_15`-Canvas-Füllung).
- Ingest-Skript, GitHub Action, Cron.
- ICON-CH2 (bleibt deaktiviert).
- Farbpalette, Canvas-Renderer, Crossfade-/Pause-Tween-Logik.

## Hinweise

- 700 hPa ist Standard-Steuerniveau für die ICON-Synoptik. Wenn ein Fall mal daneben liegt (sehr flache Schauer), können wir später ein 700/850-Mittel ergänzen.
- Wind-Werte je Grid-Punkt: Wir nutzen den lokalen Wind am Ziel-Pixel — räumlich heterogene Lagen werden so korrekt erfasst.
- Bei Wind 0 m/s ist `advect` die Identität → Verhalten = Crossfade wie vorher.
