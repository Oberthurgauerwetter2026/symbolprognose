## Plan

### Datenlage (zur Klärung)
- **ICON-CH1** liefert nativ `minutely_15` (15-min-Takt). Die Backend-Pipeline `getRadarFrames` in `src/lib/radar.functions.ts` produziert bereits:
  - **Messung**: 5-min-Frames
  - **Prognose Phase A**: 15-min-Frames für die ersten 24 h
  - **Prognose Phase B**: 1-h-Frames ab 24 h bis +48 h
- Die gewünschte Cadence ist also datenseitig schon korrekt. Nichts an `radar.functions.ts` ändern.

### Was am Client (`radar-map.tsx`) tatsächlich falsch ist
- Beim Play wurde die Animation komplett deaktiviert → springt nur noch hart von Frame zu Frame.
- Beim Scrubben am Slider rastet die Anzeige nicht sauber auf die echten Daten-Frames (15 min / 1 h) ein.

### Anpassungen (ohne Crossfading, ohne „Weichmachen")

1. **Play wieder flüssig laufen lassen — aber ohne Bildmischung**
   - Per `requestAnimationFrame` läuft eine kontinuierliche Zeit `playMs`, die linear zwischen Frame N und Frame N+1 der jeweiligen Cadence (5 / 15 / 60 min) interpoliert.
   - **Marker, Bubble, Zeit-Label** folgen `playMs` weich (das ist die wahrgenommene „Bewegung").
   - **Das Radar-Bild selbst schaltet hart** beim Übergang zum nächsten Frame um — kein Crossfade, kein Blending, kein Overlay.
   - Effekt: Zeitachse läuft glatt, NS-Felder springen weiterhin „ehrlich" frameweise — passt zur Vorgabe „synchron mit der Bewegung der NS-Felder, kein Weichmachen".

2. **Scrubben (Slider-Drag)**
   - Beim Ziehen wird der Slider-Wert auf die nächstgelegene Cadence-Stützstelle gerundet (5 min / 15 min / 1 h je nach Zeitbereich).
   - Marker + Bubble folgen kontinuierlich dem Finger; Radar-Bild wechselt exakt an den Cadence-Grenzen — keine Zwischenframes erfunden.

3. **Speed-Regler**
   - Bestimmt nur die Realzeit-Dauer pro Cadence-Schritt (z. B. 15-min-Schritt = 1.2 s bei 1×). Keine Änderung an Frame-Auswahl.

### Prüfen
- `/karten/radar`: Play startet, Zeit-Label läuft fliessend, Radar-Tiles wechseln frameweise (Messung alle 5 min, Prognose 0–24 h alle 15 min, danach stündlich).
- Slider-Drag: Bubble folgt Maus weich, Bild rastet auf nächstem Cadence-Frame ein.
- Keine 1-min-Zwischenzeiten mehr in der Zeitanzeige.
