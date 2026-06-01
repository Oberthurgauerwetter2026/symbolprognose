## Ziel

Nur in der **Prognose** (`PrecipOverlay`, wenn `currentFrame.source !== "radar"`): Niederschlagsbänder fliessen sanft zwischen zwei Modell-Zeitschritten statt zu pulsieren. Messung (PNG-Bilder) bleibt **komplett unberührt**. Mobile-tauglich.

## Änderungen

Alle in `src/components/maps/radar-map.tsx`, nur im `PrecipOverlay`-Renderpfad.

### 1. Phase-Correlation zwischen aufeinanderfolgenden Forecast-Frames

- Beim Wechsel des Frame-Paars `(vals_a, vals_b)` einmal einen globalen Verschiebungsvektor `(dx, dy)` in Grid-Zellen schätzen.
- Methode: **diskrete Kreuzkorrelation** auf einem heruntergerechneten Grid (z. B. 32×32 Bilinear-Resample der Werte), Suchfenster ±4 Zellen → ~80 Vergleiche × 1024 Pixel ≈ ein paar ms, einmal pro Frame-Paar (nicht pro Animations-Tick).
- Ergebnis cachen in einem `useRef<Map<string, {dx,dy}>>`, Key = `${frame_a.t}|${frame_b.t}`.
- Fallback `(0,0)` bei zu wenig Signal (max Korrelation < Schwelle) oder wenn `vals_b` fehlt.

### 2. Advektives Sampling im bestehenden Bilinear-Pfad

- Bisher: `v = lerp(sample(vals_a, x, y), sample(vals_b, x, y), alpha)`.
- Neu (nur Prognose): 
  - `v_a = sample(vals_a, x + alpha·dx,       y + alpha·dy)`
  - `v_b = sample(vals_b, x - (1-alpha)·dx,   y - (1-alpha)·dy)`
  - `v = lerp(v_a, v_b, smoothstep(alpha))`
- Dezent ⇒ Vektor mit `0.4` multiplizieren, hart auf max. 1.5 Zellen clampen.
- `smoothstep` statt linear ⇒ ruhigerer Übergang an Bandkanten (das war der „leichte Crossfade"-Teil).

### 3. Messung & Radar bleiben unverändert

- Im Radar-Pfad (`currentFrame.source === "radar"`) keine Advektion, kein smoothstep — exakt aktueller Code.
- PNG-Layer (Messung) wird gar nicht angefasst.

### 4. Mobile-Sicherheit

- Phase-Correlation nur auf 32×32-Downsample → Worst-Case ein paar ms, einmal pro Frame-Paar, nicht pro rAF-Tick.
- Ergebnis pro Frame-Paar gecached → bei Loop-Wiederholung 0 Zusatzkosten.
- Kein zusätzlicher Canvas, kein FFT, keine WebGL-Abhängigkeit.
- Bestehende Responsive-Logik (Container-Queries, Touch-Controls) bleibt unverändert.

## Technische Notiz

Die Phase-Correlation läuft im selben `useMemo`/Effect, in dem heute schon `vals_a` und `vals_b` decodiert werden — also einmal pro Frame-Wechsel, nicht pro Animations-Tick. Der Sampling-Hot-Path bekommt nur zwei zusätzliche Multiplikationen und Additionen pro Pixel, was im bestehenden Render-Budget unsichtbar ist.

## Out of Scope

- Pro-Zelle-Wind aus u/v (nicht jetzt).
- Farbänderungen, Konturlogik, Snow-Handling — alles unverändert.
- Messpfad / PNG-Overlay — explizit nicht anfassen.
