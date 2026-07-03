## Ziel
Die Prognose im Niederschlagsradar wird wieder auf die ursprüngliche harte Frame-Darstellung vor dem flüssigen Filmstrip zurückgestellt: keine zeitliche Zwischenlogik, kein Crossfade, kein kontinuierliches Prognose-Rendering.

## Festgestellte Ursache
- In `src/components/maps/radar-map.tsx` existiert trotz entferntem Canvas-Crossfade weiterhin eine kontinuierliche Timeline-Schicht:
  - `timelineStateForMs(...)` berechnet Zwischenzustände mit `nextFrame` und `progress`.
  - `renderMs`, `playVisualMs`, `scrubVisualMs` treiben die sichtbare Karte über eine fortlaufende Zeit statt über den ausgewählten Frame.
  - Der Play-Loop läuft per `requestAnimationFrame` über Zwischenzeiten und synchronisiert das Overlay nur gedrosselt.
  - Im JSX wird der sichtbare Prognoseframe aus `timelineStateForMs(frames, rtMs)` abgeleitet, nicht direkt aus `currentFrame`.
- Dadurch wirkt die Prognose weiterhin wie Crossfade/Interpolationslogik, obwohl das direkte `globalAlpha`-Blending bereits entfernt wurde.

## Umsetzung
1. **Kontinuierliche Prognose-Zeit entfernen**
   - `renderMs`, `playVisualMs`, `scrubVisualMs` und zugehörige Refs/Effekte aus dem sichtbaren Overlay-Pfad entfernen.
   - `timelineStateForMs`/`bracketFramesForMs` nicht mehr für die Kartenanzeige verwenden.
   - `nextFrame`/`progress`-Ableitung vollständig aus dem Radar-Overlay-JSX entfernen.

2. **Karte wieder direkt über `currentFrame` rendern**
   - Prognose-Canvas (`PrecipOverlay`) erhält ausschließlich `currentFrame`.
   - Messungs-PNG/Canvas (`MeasurementCanvasOverlay`) erhält ausschließlich `currentFrame.precipUrl`.
   - Kein Warm-/Übergangsframe (`warmGrid`, `overlayNext`) mehr im sichtbaren Pfad.

3. **Play-Loop auf ursprüngliche Frame-Schritte zurückstellen**
   - Automatische Wiedergabe erhöht wieder den Index auf die nächste vorhandene Timeline-Position.
   - Kein `requestAnimationFrame`-Durchlaufen von Zwischenzeiten für die Kartenanzeige.
   - Scrubbing/Buttons setzen direkt den nächstgelegenen Frame-Index.

4. **Filmstrip nur als Bedien-/Anzeigeelement behalten**
   - Der Filmstrip darf optisch scrollen, aber die Karte zeigt nur den hart ausgewählten Frame.
   - Falls nötig wird die Filmstrip-Transition beim manuellen Wechsel neutralisiert, damit keine „flüssige“ Prognose-Semantik mehr in die Kartenlogik zurückwirkt.

5. **Verbleibende Glättungsreste prüfen**
   - Tote Variablen wie `overlayProg`, `colorForSmooth` oder Kommentare zu kontinuierlichem Rendering entfernen/anpassen, sofern sie nicht mehr genutzt werden.
   - Keine Änderungen an Satellit oder Niederschlagssummenkarte, außer falls TypeScript durch entfernte Radar-Logik ungenutzte Importe meldet.

## Validierung
- Per Suche sicherstellen, dass im Radar-Prognosepfad keine `nextFrame`/`progress`/`globalAlpha`/Crossfade-Logik mehr aktiv ist.
- TypeScript prüfen.
- Optional im Preview auf `/karten/radar` prüfen: Play und Scrubbing wechseln klare Einzelbilder ohne Überblendung.