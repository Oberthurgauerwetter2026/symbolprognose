## Befund

Die normalen Satellitenbilder laden. Beim Wechsel auf „Schweiz HD“ wird aber kein einziges GIBS/HD-Tile angefordert. Ursache ist ein Index-Fehler beim Regionswechsel: Die Karte übernimmt kurz den alten Frame-Index der 10-Minuten-Animation, der für die 5 täglichen HD-Frames außerhalb des gültigen Bereichs liegt. Dadurch mountet `FrameStack` keinen Layer, es entstehen keine Bild-Requests, und die Anzeige bleibt bei `0/5`.

## Plan

1. **Index beim Regions-/Frame-Wechsel absichern**
   - Den an `FrameStack` übergebenen `initialIndex` auf den gültigen Bereich `0..frames.length-1` begrenzen.
   - Beim Wechsel auf eine Region mit anderer Frame-Anzahl sofort auf den letzten verfügbaren Frame springen.

2. **FrameStack robuster machen**
   - In `FrameStack` zusätzlich defensiv clampen, damit auch bei zukünftigen Daten-/Regionwechseln immer mindestens ein gültiger Frame gemountet wird.
   - Effekt-Abhängigkeiten sauber ergänzen, damit Provider/Layer/TileMatrix-Wechsel zuverlässig neue Tile-Layer erzeugen.

3. **HD-Timeline korrekt halten**
   - Sicherstellen, dass die täglichen HD-Frames nicht durch einen alten Stunden-Index blockiert werden.
   - Optional nur minimal: Labels bleiben wie bisher, Fokus ist das Laden der Bilder.

4. **Verifikation**
   - Im Browser auf `/karten/satellit` testen.
   - „Schweiz HD“ anklicken und prüfen, dass GIBS-Bildkacheln im DOM erscheinen, mindestens ein Tile lädt, `0/5` verschwindet und ein sichtbares Bild angezeigt wird.