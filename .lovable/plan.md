# Radar-Prognose: weiche Übergänge auch in den ersten ~24 Stunden

## Warum es erst nach ca. 24 Stunden gut aussieht

Der Zeitregler zeigt die Prognose im Stundentakt. Die Überblendung wird aber nicht aus dem Stundenraster berechnet, sondern aus der Liste der vorhandenen Prognosefelder:

- **Erste ~24–33 Stunden**: Hier liefert ICON-CH1 Felder im 15-Minuten-Takt (Bild-Frames). Der Übergang wird deshalb über eine 15-Minuten-Lücke berechnet, während der Regler in Stundenschritten springt. Beim Landen auf einer voller Stunde steht der Fade-Fortschritt genau auf 0 — es wird also gar nicht übergeblendet, sondern hart geschnitten.
- **Ab ca. 24–33 Stunden**: Dort existieren nur noch Stundenfelder. Nachbarfeld und nächster Reglerschritt sind identisch, der Fade läuft über die volle Stunde — genau das gewünschte ruhige Verhalten.

Es ist also kein Datenqualitäts-, sondern ein Kadenz-Problem: Fade-Fenster (15 min) und Anzeige-Schritt (60 min) passen im vorderen Bereich nicht zusammen.

## Was sich ändert

- Der Übergang wird künftig immer aus dem **angezeigten Zeitraster** abgeleitet (Prognose = Stundenschritt), nicht aus dem Feldabstand der Rohdaten.
- Damit blenden die ersten Prognosestunden genauso ruhig über wie die späteren: gleiches Fade-Fenster, gleiche Kurve, gleiche Dauer über den ganzen Prognosezeitraum.
- Übergeblendet wird jeweils vom aktuell gezeigten Stundenfeld zum Feld der nächsten volle Stunde; die 15-Minuten-Zwischenfelder werden nicht mehr als Fade-Ziel benutzt.
- Messung bleibt unverändert: 5-Minuten-Takt, harte Frame-Wechsel.
- Play und manuelles Scrubben verhalten sich gleich.

## Technische Umsetzung

Nur `src/components/maps/radar-map.tsx`:

- `timelineStateForMs` (bzw. der Aufrufpunkt im Overlay-Block) erhält für Prognosezeiten das Bracket aus `timelineSteps` statt aus `bracketFramesForMs(frames, …)`: vorherigen/nächsten Stundenschritt bestimmen, `progress` als Anteil innerhalb dieses Stundenintervalls berechnen.
- Zu den beiden Stundenschritten die tatsächlichen Frames per bestehender Nearest-Suche auflösen und als `frame`/`nextFrame` an `CrossfadePrecipOverlay` bzw. `PrecipOverlay` geben.
- `fadeWeight` (Fenster 0.55, Perlin-Smoothstep) und `QSTEPS` bleiben unverändert.
- Messzeiten (`source === "radar"`) behalten den bisherigen Pfad ohne Fade.
- Prefetch/Cache-Logik unverändert.

## Validierung

- Preview: Play über die ersten Prognosestunden — kein harter Schnitt mehr an den Stundenmarken.
- Scrubben über die Grenze bei ~24 h: gleiches Übergangsverhalten davor und danach.
