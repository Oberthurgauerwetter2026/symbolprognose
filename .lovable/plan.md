# Rutschspuren im Glätte-Symbol organisch schlängeln

Das Auto passt, aber die beiden Spuren unter dem Auto wirken noch zu eckig/kompakt. Sie werden wie in der Vorlage als lange, weich mäandernde Schlängellinien neu gezeichnet.

## Umsetzung

1. `src/components/warnings/hazard-svg.ts` – die Konstante `SKID` wird ersetzt:
   - Statt der aktuellen Kombination aus geraden Horizontalen und engen Kehren entsteht eine durchgehende Kurve aus vier weichen Bögen (kubische Béziers), die abwechselnd nach links und rechts ausschwingen — genau der „S-über-S“-Verlauf der Vorlage.
   - Verlauf: Start rechts oben, weit nach links schwingen, unten wieder nach rechts, dann nochmals nach links auslaufen — mit runden Enden und leicht ungleichen Amplituden, damit es handgezeichnet und nicht schematisch wirkt.
   - Vertikale Ausdehnung ca. y 16.3–22.4, Breite je Spur ca. 5 Einheiten, damit beide Spuren nebeneinander frei stehen.

2. Die zweite Spur bleibt eine versetzte Kopie, wird aber leicht in der Höhe versetzt (wie in der Vorlage, wo die rechte Spur etwas höher beginnt), damit die beiden Spuren nicht wie ein Muster aussehen.

3. Rendering in allen drei Warnstufen plus Kleinansicht (28 px) prüfen und die Kurven anhand des Ergebnisses nachjustieren.

4. Push-PNGs in `public/warn-icons/` mit `scripts/gen-warn-icons.ts` neu erzeugen, damit Karte, Legende, Admin-Tool und Benachrichtigungen identisch sind.
