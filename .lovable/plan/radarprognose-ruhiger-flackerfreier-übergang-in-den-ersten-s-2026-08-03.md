# Radarprognose: ruhiger, flackerfreier Übergang in den ersten Stunden

Ziel: Die Prognose-Animation wirkt durchgehend wie in einer hochwertigen Wetter-App — stabile Flächen, ruhige Übergänge, keine Helligkeits-/Dichtesprünge. Es wird weiterhin keine Bewegung erfunden.

## Was aktuell passiert

- Nur die ersten Prognosestunden bestehen aus echten ICON-CH1-Bildfeldern (15-Minuten-Takt). Genau dort läuft der Crossfade.
- Der Crossfade legt zwei halbtransparente Ebenen übereinander und animiert deren Deckkraft. Weil sich zwei transparente Schichten nicht addieren, sondern übereinander liegen, wird die Fläche in der Mitte des Übergangs kurz dichter/dunkler und danach wieder heller — das ist das „überspitzte" Pumpen und Flackern.
- Zusätzlich wird die neue Ebene eingehängt, bevor ihr Bild fertig gezeichnet ist; in dem Moment fehlt kurz Fläche.
- Ab der späteren Prognose (Stundenfelder ohne Bildpfad) läuft ein harter Wechsel ohne Fade — deshalb ist dort kein Flackern sichtbar.

## Was sich ändert

1. **Ein einziger Niederschlags-Layer statt zwei gestapelter**
   - Der Übergang wird innerhalb einer Zeichenfläche gemischt: altes und neues Feld werden gewichtet zusammengeführt und als ein Bild mit konstanter Gesamtdeckkraft ausgegeben.
   - Ergebnis: die Farbdichte bleibt über den ganzen Übergang gleich — kein Aufhellen, kein Nachdunkeln, kein Aufblitzen.

2. **Erst wechseln, wenn das nächste Feld fertig ist**
   - Der Übergang startet erst, wenn das neue Feld dekodiert und gezeichnet vorliegt; bis dahin bleibt das bisherige Feld unverändert stehen. Keine leeren Zwischenmomente mehr.

3. **Ruhigere Fade-Kurve und passende Dauer**
   - Weiche Ease-in-out-Kurve, Dauer an die Schrittlänge gekoppelt (ca. 40 % des Schritts, gedeckelt), so dass jedes Feld deutlich länger stabil steht als es überblendet.
   - Beim manuellen Scrubbing wird der Fade sehr kurz gehalten bzw. übersprungen, damit die Bedienung direkt reagiert.

4. **Gleiches Verhalten über die ganze Prognose**
   - Auch die späteren Stundenfelder (ohne Bildpfad) erhalten denselben ruhigen Übergang, statt hart umzuschalten — damit wirkt die Animation von vorn bis hinten gleich.

Unverändert: keine Optical-Flow-Berechnung, kein Morphing, keine geschätzte Zellverlagerung, keine Änderung der Farbskala, Schwellen oder Zeitraster (Messung 5 min, Prognose auf echten Modellfeldern).

## Technische Umsetzung

- `src/components/maps/radar-map.tsx`
  - `CrossfadePrecipOverlay` durch eine Variante ersetzen, die **einen** Canvas-Layer rendert und die beiden gecachten Frame-Canvases mit Gewichten `(1-p)`/`p` in einen Zwischen-Canvas komponiert (globalAlpha-Mischung im Offscreen, anschliessend ein Draw mit fixer Layer-Opazität 0.6). Der bestehende `frameCanvasCacheRef`-Cache in `MeasurementCanvasOverlay` liefert die Quell-Canvases; dafür wird der Renderpfad so erweitert, dass er zwei URLs (from/to) plus Fade-Fortschritt annimmt.
  - Fade erst starten, wenn der Ziel-Frame dekodiert ist (vorhandene Decode-/Prefetch-Logik als Gate nutzen); vorher `p = 0` halten.
  - Fade-Dauer aus dem lokalen Timeline-Schritt ableiten (`min(0.4 * gap, 600 ms)`), Scrub-Fade auf ~120 ms.
  - `PrecipOverlay` (Grid-Pfad für die späteren Stundenfelder) denselben Fade-Fortschritt als Gewicht zwischen zwei Wertefeldern nutzen, ausschliesslich als Deckkraft-/Dichtemischung ohne Geometrieänderung.
- Keine Änderungen an Ingest-Skripten, Datenquellen oder Backend.
