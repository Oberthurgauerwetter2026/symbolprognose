# Ns-Radar: Performance-Fix gegen UI-Lag

## Ursache

Der Prognose-Layer in `src/components/maps/radar-map.tsx` rechnet pro Redraw **pro Bildschirm-Pixel** mehrere `fbm`-Aufrufe (Sample-Verzerrung + 3-Frequenz-Envelope + Modulation), jede `fbm` macht 5 Oktaven Value-Noise mit Hash. Bei `STEP = 1` und 1737×1241 px sind das ~2 Mio. Pixel × ~9 fbm × 5 Oktaven pro Redraw — und Redraw läuft auf **jedem Progress-Tick** der Frame-Animation. Das blockiert den Main-Thread und macht Buttons (z. B. „Bestätigen") träge.

## Ziel

Gleiche Optik (harte Iso-Bänder, gewellte Konturen, keine 90°-Ecken), aber UI bleibt flüssig. Keine Glättung, kein Weichmachen.

## Änderungen (nur `src/components/maps/radar-map.tsx`)

1. **Noise-Maske cachen, nicht pro Progress-Tick neu rechnen.**
   - Die teure Sample-Verzerrung (`dX`, `dY`) und die Envelope (`mod * envelope`) hängen nur von `fxRaw/fyRaw` und `seed` ab — nicht von `progress`.
   - Beim Frame- oder Viewport-Wechsel einmal zwei `Float32Array`s der Grösse `lowW*lowH` befüllen: `dxArr`, `dyArr`, `maskArr`.
   - Während der Progress-Animation nur noch `sampleAt` + `lerp` + `colorFor` ausführen → ~10× günstiger pro Tick.
   - Cache-Key: `frame.t + size.x + size.y + map.getZoom() + bounds.toBBoxString()`.

2. **`STEP = 2` auch für Prognose.**
   - Halbiert die Pixelarbeit auf 1/4. Sichtbare Pixel-Kanten bleiben erhalten (Optik unverändert), weil `imageSmoothingEnabled = false` bleibt.

3. **fbm-Oktaven 5 → 3 für Envelope/Distortion.**
   - Die hochfrequenten Oktaven sind durch Nearest-Neighbour-Upscaling sowieso nicht sichtbar.

4. **Redraw entkoppeln.**
   - `useEffect` aufteilen: `[frame, nextFrame, payload]` (Maske neu) vs. `[progress]` (nur Farbpass).

## Erwartung

- Maskenberechnung ~1×/15 min statt ~60×/s.
- Per-Progress-Redraw nur noch eine Schleife mit `sampleAt + colorFor`.
- UI-Interaktionen (Buttons, Slider) reagieren wieder sofort, Optik des Niederschlagsfeldes bleibt identisch.
