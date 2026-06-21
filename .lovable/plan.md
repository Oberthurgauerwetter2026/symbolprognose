## Befund

Das Problem liegt sehr wahrscheinlich nicht im Karten-Frontend und nicht an einer fehlenden „Weichzeichnung“, sondern im aktuellen Radar-Ingest:

- Seit kurzem wird `scripts/ingest_radar.py` mit `RADAR_INGEST_VERSION = "v22-native-raster"` genutzt.
- Dabei wurde von CPC auf RZC umgestellt (`ASSET_PREFIX.precip = "rzc"`).
- Gleichzeitig wird das MeteoSchweiz-Raster mit `nearest-neighbour` in ein PNG umprojiziert und dann im Frontend mit `image-rendering: pixelated/crisp-edges` angezeigt.
- Wenn am Rand der Radar-Abdeckung oder bei No-Data/Nullwerten ein harter Sprung entsteht, wird dieser dadurch als scharfe diagonale Kante sichtbar.

Das erklärt auch „erst seit kurzem“: die Änderung kam mit dem neuen nativen Raster-/RZC-Ingest und der sehr scharfen Anzeige der PNGs.

## Ziel

Die harte Kante entfernen, ohne Niederschlagsflächen zu glätten, weichzuzeichnen oder künstlich zu feathern.

## Plan

1. **No-Data sauber behandeln**
   - Im Radar-Ingest prüfen/ergänzen, dass echte No-Data-/Undetect-Werte aus dem H5 nicht als `0 mm/h` in das PNG laufen.
   - No-Data bleibt transparent, echter `0 mm/h` bleibt trocken/transparent.
   - Dadurch verschwindet eine künstliche Abdeckungskante, ohne dass Niederschlagswerte verändert werden.

2. **Reprojektion robuster machen, aber nicht glätten**
   - `sample_to_bbox()` so anpassen, dass die native Pixel-Zuordnung geometrisch sauberer über Pixelzentren erfolgt.
   - Weiterhin nearest-neighbour verwenden, also keine bilineare Interpolation und keine weicheren Niederschlagskanten.

3. **Frontend-Schärfung entschärfen, nicht glätten**
   - In `.mch-precip` die zusätzliche CSS-Schärfung/Verstärkung prüfen: aktuell `image-rendering: pixelated`, `crisp-edges` und `filter: contrast(1.1)`.
   - Den Kontrastfilter entfernen, falls er die vorhandene Kante zusätzlich hart sichtbar macht.
   - Raster bleibt weiterhin scharf; es wird kein Blur/Smoothing aktiviert.

4. **Version erhöhen und Rebuild erzwingen**
   - `RADAR_INGEST_VERSION` erhöhen, damit alte PNGs bereinigt und mit der korrigierten Pipeline neu erzeugt werden.
   - Danach nutzt die Karte neue Radar-PNGs statt gemischter alter Artefakte.

5. **Validierung**
   - Radar-Frame mit sichtbarer Kante prüfen.
   - Erwartung: kein künstlicher diagonaler Schnitt mehr; echte Pixel-/Iso-Kanten bleiben klar und ungeglättet.