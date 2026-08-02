# Niederschlagsradar: Prognose im Stundentakt scrollbar

## Ziel

Im Filmstrip bleibt die Messung im 5-Minuten-Takt (echte Radarframes). Der Prognoseteil rastet nur noch auf volle Stunden, sodass man beim Scrollen deutlich weniger Zwischenschritte durchläuft. Die vorhandenen 15-Minuten-Prognosebilder bleiben erhalten und dienen weiterhin der flüssigen Animation zwischen den Stundenmarken.

## Verhalten

- Ziehen/Scrubben: Messung 5-min-Schritte, Prognose exakt auf 22:00, 23:00, 00:00 …
- Abspielen: pro Stundenschritt wird zwischen den echten 15-min-Frames weiter gemorpht, also weiche Bewegung ohne Standbilder.
- Übergang Messung → erste Prognose-Stunde ohne doppelten Schritt.
- Fällt eine Stundenmarke nicht exakt mit einem Frame zusammen, wird die nächstliegende Frame-Zeit im Toleranzfenster genutzt; ohne Treffer bleibt die virtuelle Stundenzeit (Karte interpoliert).

## Technische Details

- Nur `src/components/maps/radar-map.tsx`:
  - `timelineSteps`: Prognoseteil ersetzt die Frame-Liste durch ein 60-Minuten-Raster von der ersten vollen Stunde nach `nowMs` bis `lastMs`; Snap auf reale Frame-Zeiten mit Toleranz (±7.5 min), sonst virtueller Zeitpunkt.
  - `gapAtMs` im Play-Loop liest die Schrittweite weiterhin aus dem Raster, damit die Stundenschritte nicht durchrasen; ggf. Deckelung der Anzeigedauer pro Schritt, damit die Prognose nicht zu langsam läuft.
  - Rendering bleibt über `renderMs` kontinuierlich (Optical-Flow-Morphing unverändert).
- `filmstrip-timeline.tsx` bleibt unverändert (rastet schon auf die übergebenen Schritte).
- Keine Backend-/Ingest-Änderung.
