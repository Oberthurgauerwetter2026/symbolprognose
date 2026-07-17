## Plan

1. **Ursache beheben statt Optik kaschieren**
   - Die sichtbaren Punkte sind keine Crossfade-/Frontend-Artefakte, sondern einzelne kleine Raster-Komponenten im fertigen Niederschlags-PNG.
   - Die aktuelle Bereinigung entfernt zwar sehr kleine Komponenten pro Intensitätsband, ist aber zu konservativ und demotet höhere Einzelpixel nur in tiefere Klassen. Dadurch bleiben gelbe/grüne Sprenkel als hellere oder tiefere Pixel innerhalb/bei Flächen sichtbar.

2. **Bereinigung auf Farbbänder statt Rohwerte umstellen**
   - Vor dem PNG-Färben wird das Niederschlagsfeld in diskrete Farbklassen quantisiert.
   - Kleine isolierte Komponenten werden dann auf Klassenebene entfernt, nicht nur schrittweise auf den nächsttieferen Schwellenwert geschoben.
   - Ergebnis: Einzelpixel, kleine Quadrate und Mini-Inseln verschwinden vollständig aus dem Niederschlagsbild, ohne Blur, ohne Crossfade, ohne Konturglättung.

3. **Keine Änderung an Farben, Formen, Auflösung oder Frontend**
   - Die bestehende Farbskala bleibt exakt gleich.
   - Die PNG-Auflösung bleibt gleich.
   - Leaflet/ImageOverlay, Opacity, Timeline, Crossfade-Verhalten und Karten-Styling bleiben unverändert.
   - Es wird nur die Erzeugung der PNG-Rasterdaten angepasst.

4. **Messung und Prognose identisch behandeln**
   - `scripts/ingest_radar.py`: Radar-Messungs-PNGs mit derselben robusteren Klassenbereinigung erzeugen.
   - `scripts/ingest_openmeteo.py`: Prognose-PNGs mit derselben Logik erzeugen, damit Messung und Prognose konsistent bleiben.
   - Die vorhandene `_morph.py` wird gezielt erweitert, statt eine optische Nachbearbeitung einzubauen.

5. **Cache-Neuerzeugung erzwingen**
   - Die Radar-Ingest-Version wird angehoben, damit alte, bereits gespeicherte PNGs nicht weiterverwendet werden.
   - Forecast-PNGs werden beim nächsten Open-Meteo-Ingest ohnehin neu geschrieben; die Bereinigung greift dort bei der nächsten Cache-Erzeugung.

6. **Validierung**
   - Mit einem synthetischen Raster prüfen, dass:
     - Einzelpixel und kleine Quadrate verschwinden,
     - zusammenhängende Niederschlagsflächen erhalten bleiben,
     - keine Weichzeichnung oder Konturverschiebung entsteht,
     - Farben/Schwellen unverändert bleiben.