## Ziel

Crossfade zwischen Radar-Frames im Niederschlagsradar entfernen. Jeder Frame soll wieder hart angezeigt werden, ohne Alpha-Überblendung zum nächsten Frame. Timeline, Autoplay und Scrubbing bleiben unverändert und verwenden weiterhin dieselbe Zeitachse.

## Ursache

In `src/components/maps/radar-map.tsx` gibt es zwei Zeichenpfade, die pro RAF-Tick den nächsten Frame mit einem `globalAlpha = progress` über den aktuellen Frame legen:

1. `PrecipOverlay` (Gitter-Renderer), Zeilen ~810–838: `blendActive` + `ctx.drawImage(nextOff, …)` mit `progress`.
2. `PrecipRasterOverlay` (WMS-Raster), Zeilen ~1741–1755: `nextOff` + `ctx.globalAlpha = blendProgress`.

Beides erzeugt den vom Nutzer beanstandeten Crossfade.

## Änderungen

Nur `src/components/maps/radar-map.tsx`:

1. Im `PrecipOverlay`-Draw (Block bei `blendActive`) den zweiten `drawImage`-Aufruf inklusive `globalAlpha` entfernen. Es bleibt ausschließlich `ctx.drawImage(off, …)` für den aktuellen Frame. `blendActive`/`nf`-Berechnung wird zurückgebaut, da nicht mehr genutzt.
2. Im `PrecipRasterOverlay`-Draw den `if (nextOff && blendProgress > 0)`-Block samt `nextOff`-Vorbereitung (nextRaster/nextVals/buildRasterOffscreen für den nächsten Frame) entfernen. Nur der aktuelle Frame wird gezeichnet.
3. Die Refs `nextFrameRef`/`progressRef` und der `setTimeline`-Sync bleiben erhalten, damit die Zeitachse und die Prop-Weitergabe (`nextFrame`, `progress`) für Filmstrip/Scrub-Anzeige unverändert weiterlaufen. Der Draw ignoriert `progress` künftig einfach.
4. `useEffect([nextFrame, progress, payload])` wird auf `[frame, payload]` bzw. auf reines Payload/Frame-Redraw reduziert, sodass kein Repaint pro Scrub-Zwischenschritt mehr passiert (verhindert Flimmern beim Scrubbing).
5. Kommentare, die noch auf „Crossfade/Soft-Blending/Intensitäts-Interpolation" verweisen, an die neue Realität anpassen.

Keine Änderungen an Timeline-Berechnung (`resolveTimelineState`), Filmstrip, Autoplay-Loop, `RadarMap`-Props oder anderen Karten (Satellit, Wind, Niederschlags-Akkumulation).

## Verifikation

- TypeScript-Check (`tsgo`) läuft grün.
- Vorschau `/karten/radar` und `/karten/niederschlag`: Autoplay zeigt harte Frame-Übergänge ohne Überblendung; Scrubbing schaltet direkt auf den zeitlich nächsten Frame; Zeitachse und Filmstrip verhalten sich wie vor der Crossfade-Einführung.
