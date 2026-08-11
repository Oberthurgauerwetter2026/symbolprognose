Hinweis "Keine aktiven Blitze im Alpenraum" im Satellitenbild entfernen

Ziel
- Die Benachrichtigung wird entfernt, wenn gerade keine Blitze im aktuellen Satelliten-Frame vorhanden sind.

Änderungen
1. `src/components/maps/satellite-map.tsx`
   - Entferne den absolute-positionierten Hinweis-Block (Zeilen ~662–667):
     `{showLightning && visibleStrikeCount === 0 && ( <div ...>Keine aktiven Blitze im Alpenraum</div> )}`.
   - Entferne die dafür angelegte `visibleStrikeCount` `useMemo`-Berechnung (Zeilen ~441–449), da sie danach ungenutzt ist.

Risiko
- Gering. Die Lightning-Layer-Komponente und die Blitz-Datenlogik bleiben unverändert; nur die Statusmeldung verschwindet.
