# Warnkarte auf Höhe von Radar & Wind bringen

Radar und Wind verwenden eine feste Kartenhöhe: 560 px auf dem Handy, 600 px ab Tablet/Desktop. Die Warnkarte nutzt dagegen ein 4:3-Seitenverhältnis (mind. 280 px) und ab Tablet eine variable Höhe `clamp(420px, 60vh, 760px)`. Dadurch ist sie je nach Fenster deutlich höher oder flacher als die beiden anderen Karten.

## Änderung

In `src/components/maps/warn-map.tsx`:

1. Kartencontainer (aktuell `aspect-[4/3] min-h-[280px]` + `clamp(420px,60vh,760px)`) auf dieselben Werte wie Radar/Wind setzen: `h-[560px]`, ab `sm`/`@md` `h-[600px]`. Seitenverhältnis entfällt.
2. Info-Panel rechts daneben: Höhe von `clamp(420px,60vh,760px)` auf `600px` angleichen, damit Karte und Panel im Desktop-Layout gleich hoch bleiben.

Alles andere (Zoom, Grenzen, Legende, Header, Warnliste) bleibt unverändert. Reine Layout-Änderung, keine Datenlogik.

## Prüfung

Warnkarte, Radarkarte und Windkarte in Desktop-Breite und im Handy-Hochformat nebeneinander vergleichen: gleiche Kartenhöhe, keine abgeschnittenen Bedienelemente.
