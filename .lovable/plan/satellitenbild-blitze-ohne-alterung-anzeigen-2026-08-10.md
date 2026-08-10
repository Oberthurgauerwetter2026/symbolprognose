Satellitenbild: Blitze ohne Alterung anzeigen

Aktuell werden Blitze im Satellitenbild (`src/components/maps/satellite-map.tsx`) nach Alter eingefärbt: Gelb (0–2 Min), Orange (2–8 Min), Dunkelrot (8–15 Min). Die Nutzer-Rückmeldung lautet: "satellitenbild gleiche Blitze ohne Alterung".

Geplante Änderung:
- Die altersabhängige Farbunterscheidung im Satellitenbild entfernen.
- Alle Blitze einheitlich mit `BOLT_YELLOW` aus `src/components/maps/lightning-bolt.ts` rendern.
- Grösse und/oder Opazität können weiterhin leicht mit dem Alter abnehmen, damit neuere Einschläge visuell präsenter bleiben; die Farbe bleibt jedoch konstant.
- Die Radar-Karte bleibt unverändert, da sie bereits einheitliche Blitze verwendet.

Betroffene Dateien:
- `src/components/maps/satellite-map.tsx`

Optionale Variante:
- Wenn auch Grösse/Opazität nicht alterungsabhängig sein sollen, werden alle Blitze mit identischem `size`, `opacity` und `BOLT_YELLOW` gezeichnet.

Validierung:
- Build/Typecheck erfolgreich.
- Im Satellitenbild-Preview erscheinen Blitze in einer einheitlichen Farbe, unabhängig vom Einschlagsalter.
