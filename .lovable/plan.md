## Ziel

Die Farbbänder im Windfarb-Overlay bleiben grundsätzlich klar erkennbar (wie aktuell), aber direkt an den Grenzen zwischen zwei Bändern gibt es einen kurzen, weichen Farbverlauf statt einer harten Pixelkante. So entsteht ein Kompromiss zwischen der vorherigen vollständig glatten Version und der aktuellen rein diskreten Variante.

## Änderung

Eine einzige Funktion in `src/components/maps/wind-map.tsx` wird angepasst:

**`windColor(kmh)` (Zeilen 45–51)**

Aktuell: gibt die Farbe des nächstniedrigeren Stops direkt zurück (harte Kante).

Neu: Übergangszone von ±2 km/h um jede Bandgrenze. Außerhalb dieser Zone bleibt die Farbe konstant (klares Band), innerhalb wird linear zwischen den beiden Nachbarfarben interpoliert.

Konkret:
- Finde den Index `i` des Bands, in das `kmh` fällt (höchster Stop mit `WIND_SCALE[i].v <= kmh`).
- Sei `nextV = WIND_SCALE[i+1].v` die nächste Bandgrenze.
- Wenn `kmh >= nextV - 2` und es gibt ein nächstes Band: linear mischen über das Fenster `[nextV-2, nextV+2]` (Breite 4 km/h, also ±2 um die Grenze).
- Sonst: `WIND_SCALE[i].rgb` direkt zurückgeben.

Das Übergangsfenster von 4 km/h ist schmal genug, dass die Bänder optisch dominant bleiben, aber breit genug, dass die Kante nicht mehr wie eine 1-Pixel-Stufe wirkt.

## Was nicht verändert wird

- `STEP = 1` im `WindColorOverlay` bleibt (pixelgenaue Abtastung).
- `WIND_SCALE` (Stops bei 0/20/40/60/80/100/130) bleibt unverändert.
- Partikel, Pfeile, Legende, alle anderen Layer bleiben unangetastet.

## Falls die Übergänge zu schmal/zu breit wirken

Die Halbbreite (`2` km/h) ist der einzige Tuning-Parameter. Bei Bedarf nachjustieren auf 1 (sehr schmal) oder 3–4 (deutlicher sichtbar).
