# Radarprognose: ruhige Crossfade-Animation ohne erfundene Bewegung

Ziel: Jedes ICON-CH1-Prognosefeld ist ein eigenständiger Zustand. Kein Optical Flow, kein Morphing, keine geschätzte Zellverlagerung. Übergänge nur als weiche Überblendung.

## Was sich ändert

1. **Zeitregler (Prognose)**
   - Prognoseteil rastet exakt auf die echten 15-Minuten-Prognosefelder (keine künstlichen Zwischenschritte, keine „leeren" Rasterpunkte, wenn kein Feld existiert).
   - Beim Scrubbing wird immer genau ein Feld stabil und geometrisch unverändert gezeigt — keine Zwischengeometrie.
   - Messteil bleibt wie heute im 5-Minuten-Takt auf echte Radarframes gerastet.

2. **Crossfade zwischen zwei Feldern**
   - Beim Wechsel auf ein neues Prognosefeld wird das alte Feld über 700 ms ausgeblendet, während das neue eingeblendet wird (Summe der Deckkraft bleibt konstant, kein Aufblitzen und kein Loch).
   - Der Crossfade ist eine reine Opazitätsanimation zweier fertig gerenderter Felder — die Form der Flächen bleibt während des Fades unangetastet.
   - Beim Play läuft der Crossfade zwischen den Schritten; beim manuellen Scrubbing gibt es einen kurzen Fade beim Feldwechsel, aber kein Nachziehen.

3. **Darstellung: leicht weiche, organische Konturen**
   - Die Prognosefelder werden vor dem Einfärben leicht geglättet, so dass Rasterzellen nicht als Blöcke sichtbar sind, die Optik aber nah an der Radarmessung bleibt.
   - Farbbänder (Radarfarben, halbtransparent) und Schwellen bleiben unverändert.
   - Kein Blur über fertige Farben, damit die Bänder nicht verwaschen.

4. **Playback-Qualität**
   - Animation läuft über requestAnimationFrame mit konstanter Schrittdauer pro Feld, so dass sie ruhig und gleichmässig wirkt (60 FPS, sofern die Felder vorgewärmt sind).
   - Vorhandenes Vorwärmen aller Felder bleibt aktiv, damit beim Feldwechsel nichts stockt.

## Technische Umsetzung

- `src/components/maps/radar-map.tsx`
  - `timelineSteps`: Prognoseteil nur aus tatsächlich vorhandenen Frame-Zeitpunkten aufbauen (statt fixes 15-Min-Raster mit Fallback auf synthetische Zeitpunkte).
  - Neue Crossfade-Ebene: zwei Overlay-Instanzen (aktuelles/vorheriges Feld) mit animierter Opazität über 700 ms beim Feldwechsel; `progress`/`nextFrame`-Pfad wird nicht mehr für Wertinterpolation genutzt, nur noch für den Fade.
  - `PrecipOverlay` und `MeasurementCanvasOverlay`: leichte 3×3-Gewichtsglättung des Wertefelds vor der Farbzuordnung (nur für Prognose-Frames), Rest der Renderlogik unverändert.
  - Playback-Kadenz an die reale Feldliste binden, damit die Prognose nicht durchrast.
- Keine Änderungen an Ingest-Skripten oder Backend nötig.

## Nicht enthalten

- Keine Reduktion auf volle Stunden (die 15-Minuten-Felder bleiben, laut Entscheid).
- Keine neuen Datenquellen und keine Bewegungsschätzung.
