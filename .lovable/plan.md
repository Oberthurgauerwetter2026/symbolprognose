Ich werde die Radar-Prognose nicht weichzeichnen, sondern die Geometrie der Niederschlagsflächen deutlich stärker verändern:

1. **Quadratische Prognose-Zellen eliminieren**
   - Die Niederschlagswerte werden für Prognose-Frames nicht mehr exakt auf den ursprünglichen Karten-/Modellachsen ausgewertet.
   - Stattdessen wird die Abtastposition selbst stärker, mehrskalig und nicht achsparallel verzogen.

2. **Harte, radarähnliche Konturen behalten**
   - Kein Blur, kein Canvas-Smoothing, keine weichen Übergänge.
   - Die Farbbänder bleiben diskret und kantig, aber die Konturlinien verlaufen unregelmässig statt rechteckig.

3. **Aggressivere Rand-Auflösung**
   - Die bestehende Envelope-Maske wird nochmals härter eingestellt, sodass Niederschlagsflächen stärker ausfransen und keine rechteckigen Begrenzungen behalten.
   - Zusätzlich wird eine lokale Zell-Unterdrückung eingebaut, die gerade Kanten/90°-Ecken bricht.

4. **Nur Prognose betroffen**
   - Messradar-Frames bleiben unverändert.
   - Die Änderung betrifft nur `contour={currentFrame.source !== "radar"}` bzw. die Ns-Radar-Prognose.