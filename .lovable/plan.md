# Nowcast nur bis zur nächsten vollen Stunde

## Ziel
Das weitergeschobene Radarbild läuft nur bis kurz vor dem nächsten vollen Stundenschlag (:00). Ab dort übernimmt das Modell.

Beispiele (letztes Messbild):
- 09:05 → Nowcast 09:10 … 09:55, ab 10:00 Modell
- 09:25 → Nowcast 09:30 … 09:55, ab 10:00 Modell
- 09:55 → kein Nowcast, ab 10:00 Modell

## Umsetzung
1. In der Nowcast-Berechnung die feste 60-Minuten-Grenze ersetzen durch „nächste volle Stunde nach dem letzten Messbild" (Schritte strikt davor).
2. Modellbilder zwischen dem letzten Messbild und dieser vollen Stunde ausblenden, damit keine doppelten Standbilder erscheinen; ab der vollen Stunde normal weiter.
3. Fehlt das Modellbild für die volle Stunde, bleibt die Zeitleiste einfach beim letzten Nowcast-Bild stehen (keine Verlängerung).
4. Tests ergänzen: 09:05 → 10 Schritte, 09:25 → 6, 09:50 → 1, 09:55 → 0, letzter Schritt nie ≥ volle Stunde.

## Technische Details
- `src/lib/radar-nowcast.ts`: `nowcastSteps` endet bei `ceil(lastRadarMs / 1h) * 1h` (exklusiv); `NOWCAST_HORIZON_MS` entfällt.
- `src/lib/radar.functions.ts`: Prognoseframes mit `t < nächste volle Stunde` entfernen, wenn Nowcast-Frames vorhanden sind.
- `src/lib/radar-nowcast.test.ts`: neue Fälle.
