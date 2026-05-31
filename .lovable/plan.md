## Problem

Nowcast „Wind-Fallback" zieht Niederschlag entgegen dem Wind. Bei NW-Wind (315°) wandern die Zellen nach NW statt – wie meteorologisch korrekt – nach SE. Auf dem Papier ist die Formel in `src/lib/radar.functions.ts` Z. 443–445 (`uMs = -speed·sin(dir)`, `vMs = -speed·cos(dir)`) richtig. Trotzdem stimmt es im Browser nicht. Frühere Hin-und-Her-Korrekturen am Vorzeichen (siehe #1290/#1292/#1316/#1318) zeigen: ohne harte Verifikation drehen wir nur das nächste falsche Schräubchen.

## Vorgehen: erst diagnostizieren, dann gezielt fixen

### 1. Sichtbare Wind-Pfeil-Overlay (visuelle Verifikation)

`src/components/maps/radar-map.tsx`:
- Wenn `currentFrame.source === "nowcast"`, kleines Pfeil-Overlay (SVG/HTMLOverlay) in der oberen rechten Karten-Ecke einblenden, das exakt den Vektor `(imageOffset.dLon, imageOffset.dLat)` zeigt (auf Einheitslänge normiert). Beschriftung: `"Berechnete Zugbahn: <bearing>° (<Wind|Radar>)"`.
- Damit lässt sich auf einen Blick prüfen: zeigt der Pfeil in dieselbe Richtung wie die sichtbare Zellbewegung? Wenn ja → Vorzeichen stimmt im Code, Wahrnehmung war täuschend. Wenn entgegengesetzt → Bug-Stelle eindeutig zwischen Vektorberechnung und Bbox-Shift.

### 2. Runtime-Log einbauen

`src/lib/radar.functions.ts` im Wind-Fallback-Block:
- Einmaliger `console.info` pro Request: `[radar/nowcast/wind] dir=315° speed=8.2m/s → uMs=+5.8 vMs=-5.8 → dLon/min=+0.000077 dLat/min=-0.000052 (NW-Wind → erwartet SE-Drift)`.
- Analog für Radar-Motion-Pfad: `[radar/nowcast/radar] u=… v=… growth=…`.

Damit sehen wir live im Browser-Konsolen-Output (preview console), welche Zahlen tatsächlich ankommen.

### 3. Unit-artiger Selbsttest gegen Aufruf-Fehler

Im selben File eine kleine, parameterlose Funktion `assertWindMotionSign()`:
- Prüft 4 Stichproben (dir = 0/90/180/270, speed = 10 m/s) und vergleicht das resultierende Vorzeichen von uMs/vMs gegen die Erwartung (N-Wind → v<0, E-Wind → u<0 usw.).
- Wirft `console.error` mit klarer Tabelle, falls Vorzeichen kippen. Wird einmal beim ersten `getRadarFrames`-Aufruf auf dem Server ausgeführt.
- Damit ist ein versehentliches Re-Flippen durch eine künftige Bearbeitung sofort sichtbar.

### 4. Fix erst nach Verifikation

Nachdem Punkt 1–3 deployed sind, schauen wir gemeinsam (Browser-Console + Pfeil-Overlay) was wirklich passiert. Drei mögliche Befunde:

| Befund | Ursache | Fix |
|---|---|---|
| Pfeil = Zellrichtung, beide NW → SE wie erwartet | nur Wahrnehmungsfehler | kein Code-Fix |
| Pfeil = NW, Zellen = SE | Bbox-Shift in `radar-map.tsx` Z. 992–997 invertiert | dort `−` statt `+` |
| Pfeil = Zellen, beide nach NW (= mit Wind) | Open-Meteo `wind_direction_700hPa` ist „to"-Richtung an dieser Stelle oder Code-Pfad-Fehler | Vorzeichen in Z. 444–445 + Kommentar präzisieren |

## Nicht enthalten

- Radar-Motion-FFT (`scripts/ingest_radar.py` v8) bleibt unangetastet.
- Keine Änderung am `meanWindAt` (ICON-CH1-Advektion).
- Keine Verschiebung der Update-Frequenz oder Karten-Stile.
- Kein blindes Sign-Flip im Wind-Fallback ohne vorherige Verifikation per Pfeil + Log.
