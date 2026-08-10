# Blitze im Niederschlagsradar: echte Blitz-Symbole statt Punkte

Aktuell werden die Blitze im Radar als zwei gefüllte Kreise gezeichnet (Halo + Kern), deshalb erscheinen sie als leuchtende Punkte. Statt Kreisen soll ein echtes Blitz-Zeichen (Zickzack-Bolt) kurz aufglühen.

## Was geändert wird

- Blitz-Darstellung im Niederschlagsradar: pro Einschlag ein Blitz-Glyph (Zickzack-Bolt), leicht zufällig rotiert/gespiegelt, damit es natürlich wirkt.
- Aufglüh-Effekt bleibt: heller Kern (weiss/gelb) mit weichem Glow-Schein, sofortiges Aufblitzen und Abklingen innerhalb des ersten Teils des Zeitschritts, danach verschwindet er zum nächsten Frame.
- Grösse skaliert leicht mit dem Zoom, damit der Blitz bei starkem Rauszoomen nicht die Zelle überdeckt.
- Legendeneintrag "Blitze (Blitzortung)" erhält dasselbe Blitz-Symbol statt des Punkts.
- Das Satellitenbild bleibt unverändert (dort sind Punkte mit Alterung gewünscht).

## Technisch

- `RadarLightningLayer` in `src/components/maps/radar-map.tsx`: `L.circleMarker`-Paare ersetzen durch `L.marker` mit `L.divIcon`, das ein Inline-SVG mit Bolt-Pfad rendert (zwei Ebenen: breiter, unscharfer Glow-Stroke via `filter: drop-shadow` + heller Kernpfad). Opazität/Skalierung weiterhin aus `progress` und `FLASH_FRACTION` ableiten.
- Bolt-Pfad zentral definieren (kleine Konstante in der Datei bzw. Wiederverwendung des bestehenden Blitz-Pfads aus `src/lib/hazard-svg.ts`, falls passend), damit Legende und Karte identisch aussehen.
- Zeitfensterlogik (`stepStartMs`/`stepEndMs`) und Toggle-Button/`localStorage` bleiben unverändert.
