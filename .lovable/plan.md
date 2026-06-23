## Ziel
Die Radar-Prognose soll beim Scrubben und beim Play flüssiger wirken, ohne den gewünschten Takt zu verlieren: Messung 5 min, Prognose erste 24 h 15 min, danach 1 h.

## Plan
1. **Forecast-Scrubbing entkoppeln**
   - Beim Ziehen des Sliders in der Prognose nicht mehr sofort hart auf den nächsten Frame springen.
   - Stattdessen aus der Mausposition eine Zwischenzeit berechnen und zwischen den benachbarten Forecast-Frames blenden.
   - Beim Loslassen wird sauber auf den passenden Frame eingerastet.

2. **Play-Crossfade stabilisieren**
   - Den sichtbaren Forecast-Frame und den nächsten Forecast-Frame aus einer stabilen Zeit-/Step-Position ableiten, nicht aus asynchronem `idx` + `progress`.
   - Dadurch vermeiden wir kurze Rücksprünge oder falsche `nextFrame`-Paare während React-State-Updates.

3. **Forecast-Rendering weniger ruckelig machen**
   - Den zeitabhängigen Noise/Contour-Anteil so anpassen, dass er zwischen Frames nicht neu „würfelt“.
   - Dadurch bewegt sich die Prognose nicht sprunghaft durch wechselnde Muster, sondern blendet ruhiger.

4. **Performance beim Ziehen verbessern**
   - Slider-Updates weiter per `requestAnimationFrame` drosseln.
   - Nur die nötigen Overlay-Werte neu zeichnen, keine unnötigen Layer-Neuaufbauten.

5. **Prüfung**
   - Radar-Prognose im Browser per Playwright öffnen.
   - Forecast-Bereich scrubben und Play laufen lassen.
   - Prüfen: keine rückwärts springende Uhrzeit, kein starkes Stocken beim Ziehen, Play läuft monoton und gleichmäßig.