Ziel: Der Timeslider in der Radar-Prognose soll sofort reagieren, auch bei grossem Desktop-Viewport.

Plan:
1. `PrecipOverlay` renderseitig entlasten:
   - Lat/Lon→Grid-Koordinaten (`fxRaw`, `fyRaw`) pro Viewport cachen statt bei jedem Slider-Schritt neu über Leaflet `containerPointToLatLng` zu berechnen.
   - Die Cache-Struktur um `fxArr`/`fyArr` erweitern und diese im Farbpass wiederverwenden.
2. Slider-Interaktion entkoppeln:
   - Beim Ziehen nicht jedes Pointer-Move sofort als React-State und Voll-Canvas-Render ausführen.
   - Den gewünschten Zielindex während Dragging lokal/gedrosselt sammeln und nur den letzten Wert pro Animation-Frame anwenden.
   - `progress` beim manuellen Scrubben explizit auf `0` setzen, damit kein zusätzlicher Crossfade-Render hängen bleibt.
3. Canvas-Zeichnung effizienter machen:
   - Offscreen-Canvas nicht bei jedem Redraw neu erzeugen, sondern per `useRef` wiederverwenden.
   - `createImageData`/Canvas-Grössen nur so oft wie nötig neu anlegen.
4. Prognose-Qualität bewusst leicht reduzieren, nur wenn nötig:
   - Für Prognose-Frames den Raster-Schritt adaptiv erhöhen (z. B. `STEP=3` bei sehr grossen Viewports), damit der Slider flüssig bleibt.
   - Die kantige Radar-Optik bleibt erhalten, weil weiterhin nearest-neighbour hochskaliert wird.
5. Nebenbefund beheben:
   - Die Stadt-Marker nutzen aktuell `name` als React-Key und erzeugen Duplicate-Key-Warnungen; auf stabile eindeutige Keys aus Name+Koordinaten umstellen, damit React beim Bedienen weniger unnötig arbeitet.

Validierung:
- Browser-Profiler erneut auf `/karten/radar` mit Slider-/Next-Interaktion laufen lassen.
- Prüfen, dass `hash`/`fbm` nicht mehr pro Slider-Schritt dominieren und die Bedienung sichtbar direkter reagiert.