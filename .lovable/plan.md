# Satellitenbild: Blitze als Blitz-Symbole statt Punkte

Im Satellitenbild werden die Blitze aktuell als zwei gefüllte Kreise (Glow + Kern) gezeichnet, deshalb erscheinen sie als Punkte. Neu soll dasselbe Zickzack-Blitz-Symbol verwendet werden wie im Niederschlagsradar.

## Was geändert wird

- Pro Einschlag ein Blitz-Glyph (Zickzack-Bolt) statt Kreis-Paar, leicht zufällig gedreht/gespiegelt, damit es natürlich wirkt.
- Die bestehende Alterung bleibt genau wie heute: 0–2 Min. hell/gelb und grösser, 2–8 Min. orange und kleiner werdend, 8–15 Min. dunkelrot und ausblendend, danach verschwunden.
- Farben steuern künftig Kern- und Glow-Farbe des Blitzes; Grösse/Deckkraft folgen weiterhin dem Blitz-Alter.
- Die frame-genaue Anzeige (Blitze passend zum angezeigten Zeitschritt) bleibt unverändert.

## Technisch

- Bolt-Geometrie aus `radar-map.tsx` (`BOLT_PATH`, `boltSvg`) in ein gemeinsames Modul auslagern, z. B. `src/components/maps/lightning-bolt.ts`, mit Farb-Parametern (Kernfarbe, Glow-Farbe) statt fixem Gelb; Radar nutzt es mit seinen bisherigen Werten weiter, damit dort optisch nichts ändert.
- `LightningLayer` in `src/components/maps/satellite-map.tsx`: die zwei `L.circleMarker` durch einen `L.marker` mit `L.divIcon` ersetzen, HTML aus dem Bolt-Helper; `radius` → Pixelgrösse des Symbols mappen.
- Tilt/Spiegelung deterministisch aus Zeit/Position ableiten, damit ein Blitz beim Frame-Wechsel nicht springt.
- Pane `lightning`, Lifetime (15 Min.) und Query/Datenpfad bleiben unverändert.
