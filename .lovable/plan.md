## Plan

1. **Filmstrip-Farben anpassen**
   - Messungs-Band im Filmstrip auf Grau setzen.
   - Prognose-Band blau lassen, aber mit stärkerer Deckkraft / sichtbarerem Blau.
   - Keine Rückkehr zu grün.

2. **Play-Takt korrigieren**
   - Die Play-Anzeige nicht mehr kontinuierlich zwischen zwei Frames interpolieren lassen.
   - Bubble, Marker und Filmstrip-Position bei Play nur noch auf den erlaubten Filmstrip-Schritten anzeigen:
     - Messung: 5-Minuten-Takt
     - Prognose 0–24 h: 15-Minuten-Takt
     - Prognose >24 h: 60-Minuten-Takt
   - Dadurch erscheinen bei Play keine Zwischenzeiten im 1-Minuten-Takt mehr.

3. **Gezielt prüfen**
   - Sichtprüfung auf `/karten/radar`: Messung grau, Prognose kräftiger blau.
   - Play starten und kontrollieren, dass die angezeigten Zeiten nur in der Filmstrip-Cadence springen.