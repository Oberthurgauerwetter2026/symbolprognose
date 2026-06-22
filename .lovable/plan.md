Ziel: Beim Drücken von „Play“ soll die Radar-Animation nicht mehr scheinbar zufällig springen, sondern sauber und flüssig durch die verfügbaren Frames laufen.

Umsetzung:
1. Die Play-Loop in `src/components/maps/radar-map.tsx` stabilisieren:
   - Statt bei jedem Tick per `find(i > cur)` zu suchen, einen stabilen aktuellen Step-Index verwenden.
   - Den nächsten Frame deterministisch aus der vorberechneten Play-Step-Liste berechnen.
   - Bei großen Zeitdifferenzen nicht mehrere Steps unkontrolliert überspringen.

2. Die gemischte Abspiel-Kadenz beibehalten:
   - Messung: 5-Minuten-Takt
   - Prognose bis +24 h: 15-Minuten-Takt
   - Prognose danach: 1-Stunden-Takt

3. Crossfade/Progress konsistent machen:
   - `progress` beim Step-Wechsel sauber zurücksetzen.
   - `nextFrame` aus demselben Step-Modell ableiten wie die Play-Loop.
   - Kein Rücksprung an den Anfang, solange innerhalb der Timeline noch ein nächster Step existiert.

4. Nach der Änderung im Preview prüfen:
   - Play starten.
   - Beobachten, dass Marker, Zeitlabel und Kartenlayer gleichmäßig weiterlaufen.
   - Kontrollieren, dass Scrubbing unverändert funktioniert.