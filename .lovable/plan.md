## Weg Z — Ehrliche Stundenprognose (ICON-CH1)

Keine künstliche Bewegung mehr. Wir zeigen die Niederschlagsprognose so, wie ICON-CH1 sie liefert: **stündliche Werte**, sauber dargestellt mit weichem Crossfade zwischen den Frames.

### Was sich ändert

1. **Datenmodell**
   - Frames im Stundenraster (z. B. +0h, +1h, +2h … +24h oder +48h, je nach ICON-CH1-Verfügbarkeit über Open-Meteo).
   - Pro Frame: das 36×22-Punktraster mit Niederschlag (mm/h) zu genau dieser Stunde.
   - Keine 10-Minuten-Interpolation, keine Advektion, keine Pseudo-Zwischenframes.

2. **Server (`src/lib/radar.functions.ts`)**
   - Prognose-Funktion liefert nur noch stündliche Frames direkt aus Open-Meteo ICON-CH1 (`precipitation` hourly).
   - Sämtliche Advektions-/Interpolations-Logik für die Prognose entfernen.
   - Timestamps exakt auf die volle Stunde (UTC) ausgerichtet.

3. **Client (`/karten/radar`)**
   - Slider/Timeline rastet auf Stundenschritte.
   - Beim Auto-Play: pro Frame ca. 700–1000 ms anzeigen, Übergang per **CSS-Crossfade** (zwei übereinander­liegende Canvas/Image-Layer, Opacity-Transition 300–400 ms).
   - Label klar: „Prognose +3 h · Di 14:00" — kein „Live", kein „Nowcast" für Prognose-Frames.
   - Trennung im UI zwischen *Messung/Nowcast* (falls vorhanden) und *Prognose* deutlich machen (z. B. vertikaler Strich auf der Timeline bei „jetzt").

4. **Was wir explizit NICHT tun**
   - Keine Bewegungsschätzung zwischen Stundenframes.
   - Keine 10-Min-Zwischenbilder durch Interpolation.
   - Keine Vermischung Messung ↔ Prognose im selben Frame.

### Technische Details

- `radar.functions.ts`: Prognose-Pfad liefert `frames: { tsUtc, grid }[]` strikt im 60-Min-Abstand. Bestehende Advektions-/Resample-Helpers für die Prognose entfernen (für Nowcast bleiben sie, falls dort genutzt).
- Rendering-Komponente: zwei Layer `<canvas>` A/B; bei Frame-Wechsel wird der inaktive Layer mit dem neuen Frame gezeichnet und per `opacity` eingeblendet, danach Rollen tauschen. Tailwind `transition-opacity duration-300`.
- Timeline-Marker: senkrechte Linie + Label „Jetzt" zwischen letztem Messframe und erstem Prognoseframe.
- Playback-Geschwindigkeit konfigurierbar (1×/2×), Default 1 Frame ≈ 800 ms.

### Ergebnis

Eine **ehrliche, lesbare** Stundenprognose. Kein Geflacker, kein Fake-Movement — Übergänge wirken durch den Crossfade ruhig, der Nutzer sieht aber klar: hier springt die Zeit in 1-h-Schritten.