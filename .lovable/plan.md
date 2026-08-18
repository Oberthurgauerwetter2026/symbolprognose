# Grauen Hintergrund im Lokalprognose-Embed entfernen

## Problem

Im Embed steht hinter dem Widget eine graue Fläche. Sie kommt vom globalen Seiten-Hintergrund (`body` nutzt den grauen Token `--background: zinc-100`). Die bestehende Regel, die den Hintergrund im Embed transparent macht, greift erst, wenn das JavaScript geladen ist und die Klasse `embed` auf `<html>` setzt — bis dahin (und bei ausbleibender Hydration) bleibt der graue Hintergrund sichtbar. Zusätzlich lässt der Innenabstand der Embed-Hülle die graue Fläche als Rahmen um das Widget durchscheinen.

## Lösung

1. Embed-Routen bekommen den transparenten Hintergrund bereits serverseitig: in der Wurzelroute wird für Pfade, die mit `/embed` beginnen, die Klasse `embed` direkt am `<html>`-Element gesetzt, statt erst nach dem Mounten.
2. Die Hintergrund-Regeln für `.embed-fallback` / `.embed-live` werden von Weiss auf transparent umgestellt, damit die Host-Seite (WordPress) durchscheint und kein grauer oder weisser Kasten entsteht.
3. In `/embed/lokalprognose` wird der Innenabstand der Hülle entfernt (randloses Widget), damit keine Hintergrundfläche mehr rund um das Widget sichtbar ist.

Andere Embeds (Region, Radar, Wind, Warnungen) profitieren von 1. und 2. ebenfalls; ihr Layout bleibt unverändert.

## Technische Details

- `src/routes/__root.tsx`: `embed`-Klasse für `/embed*` in die serverseitig gerenderte `<html>`-Klassenliste aufnehmen.
- `src/styles.css`: `.embed-fallback` / `.embed-live` von `background: #ffffff` auf `transparent`; die `html.embed`-Regel bleibt als Absicherung.
- `src/components/embed-shell.tsx`: optionale Prop `flush` (kein Padding); von `src/routes/embed.lokalprognose.tsx` gesetzt. Höhenmeldung per postMessage bleibt unverändert.

## Prüfung

Lokalprognose-Embed im Browser aufrufen und prüfen, dass kein grauer Hintergrund/Rahmen mehr sichtbar ist — auch direkt nach dem Laden.
