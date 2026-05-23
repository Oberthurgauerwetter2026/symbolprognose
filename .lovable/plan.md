Den Zeit-Slider und die Tages-Tabs visuell flüssig animieren, statt hart von Stufe zu Stufe zu springen.

## Zeit-Slider (stündlich)

In `src/components/region-map.tsx` / `src/styles.css`:

1. **Thumb-Bewegung weichzeichnen:** In `src/styles.css` unter `.region-slider` für den Thumb (`[class*="h-4"][class*="w-4"][class*="rounded-full"]`) eine `transition: left 220ms cubic-bezier(0.22, 1, 0.36, 1), transform 120ms ease` ergänzen. Gleiches für `[class*="bg-primary"]:not([class*="/20"])` (Range-Fill), damit die gefüllte Schiene mitgleitet.
2. **Tooltip + vertikale Linie:** Die zwei Wrapper über dem Thumb (Zeilen 535–569) erhalten eine inline `transition: "left 220ms cubic-bezier(0.22, 1, 0.36, 1)"`, damit Bubble und Linie synchron mitfliessen statt schlagartig zu springen.
3. **Stundenlabel-Aktivfarbe:** Auf den Labels in der Stundenlegende (Zeilen 603–616) eine `transition-colors duration-200` ergänzen, damit das Hervorheben der aktiven Stunde sanft wechselt.

Datenmodell bleibt unverändert: `step={1}`, `MAX_STEPS=24`. Es ist rein visuelle Glättung der Bewegung zwischen den Stundenrasterpunkten.

## Tages-Tabs (Heute / Morgen / …)

In der Tab-Leiste (Zeilen 444–498):

1. **Sliding-Indicator:** Statt den aktiven Hintergrund per `style={{ background: BRAND }}` direkt am Button zu setzen, einen einzelnen absolut positionierten Pill-Indicator im Container rendern, dessen `left` und `width` aus dem Index der aktiven Auswahl (Stündlich-Button vs. `selectedDayIdx`) berechnet werden. Wrapper auf `relative` setzen, Buttons auf `relative z-10` mit transparentem Hintergrund.
2. **Breitenmessung:** Per `useRef` auf die Button-Elemente die `offsetLeft` / `offsetWidth` lesen (in `useLayoutEffect`, auch bei Resize). Indicator erhält `transition: left 260ms cubic-bezier(0.22, 1, 0.36, 1), width 260ms cubic-bezier(0.22, 1, 0.36, 1)`.
3. **Textfarbe:** Aktive Textfarbe (`text-white`) weiterhin am aktiven Button setzen, mit `transition-colors duration-200`, damit der Farbwechsel zur gleitenden Pille passt.

## Nicht im Scope

- Keine Änderungen an Datenabfrage, Wetterlogik, Marker-Pills oder Karten-Layern.
- Slider bleibt stundengenau (kein Sub-Hour-Interpolieren der Wetterdaten).
