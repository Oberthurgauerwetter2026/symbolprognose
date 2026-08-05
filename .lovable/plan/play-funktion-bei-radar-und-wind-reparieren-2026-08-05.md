# Play-Funktion bei Radar und Wind reparieren

## Befund (im Browser überprüft)

Play funktioniert nur, solange der Zeit-Cursor nicht am Ende der Zeitachse steht. Steht er am letzten Zeitpunkt — was nach jedem Durchlauf automatisch der Fall ist, weil die Animation am Ende auf Pause schaltet — passiert beim nächsten Druck auf Play nichts: die Schleife startet am Endzeitpunkt, erkennt „Ende erreicht“ und stoppt sofort. Genau das erklärt „nichts bewegt sich“ bei Radar und Wind.

Ebenso passiert nichts, wenn man vorher mit dem Filmstrip ganz nach rechts gezogen hat.

## Was sich ändert

- Druck auf Play startet die Animation immer: steht der Cursor am (oder praktisch am) Ende, springt sie automatisch auf den Anfang der Zeitachse zurück und läuft von dort los.
- Die Animation läuft in einer Endlosschleife: am Ende der Zeitachse beginnt sie erneut von vorn, statt auf Pause zu schalten. Gestoppt wird nur durch Pause, Ziehen im Filmstrip, Schrittpfeile oder „Jetzt“.
- Gleiches Verhalten in Niederschlagsradar und Windprognose.

## Technische Details

`src/components/maps/radar-map.tsx` (Play-Loop, aktuell ca. Zeilen 1855–1931):
- `startMs`: wenn der Startwert innerhalb eines Timeline-Schritts am `lastMs` liegt, auf `firstMs` setzen.
- In `tick`: bei `nextMs >= lastMs` nicht `setPlaying(false)`, sondern `playTimeRef.current = firstMs` (Wrap-around) und weiterlaufen; Idx/RenderMs entsprechend setzen.

`src/components/maps/wind-map.tsx` (Play-Loop, aktuell ca. Zeilen 991–1026):
- Beim Start: `idxRef.current >= frames.length - 1` → auf `0` zurücksetzen.
- In `tick`: bei `next >= frames.length` auf `0` wrappen statt `setPlaying(false)`.

Keine Änderungen an Daten, Backend oder Filmstrip-Komponente.
