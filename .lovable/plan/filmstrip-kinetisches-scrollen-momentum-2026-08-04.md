# Filmstrip: kinetisches Scrollen (Momentum)

## Was sich ändert

Der Filmstrip (genutzt von Niederschlagsradar und Wind – gleiche Komponente) läuft nach dem Loslassen mit dem Schwung der letzten Zieh­bewegung weiter und wird durch Reibung sanft langsamer, bis er stehen bleibt. Kein abruptes Stoppen mehr.

- Beim Ziehen wird die aktuelle Geschwindigkeit laufend gemessen (geglättet über die letzten Bewegungen).
- Beim Loslassen: nur wenn die Geschwindigkeit über einer kleinen Schwelle liegt, startet das Nachlaufen; sonst wie bisher direktes Einrasten.
- Während des Nachlaufens rastet die Anzeige weiter auf echte Frame-Zeitpunkte ein (5-min-Messung, Prognose-Kadenz) und löst dieselben Haptik-Impulse pro Frame aus wie beim Ziehen.
- An den Enden der Zeitachse (erster/letzter Frame) stoppt der Schwung weich, statt hart zu prallen.
- Neues Antippen, ein neuer Drag, Tastaturbedienung oder Playback bricht das Nachlaufen sofort ab.
- Läuft der Schwung aus, wird der nächstgelegene Frame als endgültige Auswahl gemeldet.

## Technische Details

Nur `src/components/maps/filmstrip-timeline.tsx` (keine Änderung an Radar-/Wind-Logik, kein Backend):

- Geschwindigkeit in `onMove` aus `dx/dt` berechnen und exponentiell glätten (`v = 0.8*v + 0.2*neu`), in ms-Zeitachse umgerechnet über `PX_PER_HOUR`.
- In `onUp` statt sofortigem `setDragMs(null)` eine rAF-Schleife starten: pro Frame `ms += v*dt`, `v *= friction^(dt/16.67)` (Reibung ca. 0.95), Abbruch bei `|v|` unter Schwelle oder beim Erreichen von `tMin`/`tMax`.
- Während der Schleife weiterhin `snapAndEmit(target)` + `onScrubMs?.(target)` aufrufen, damit Karte und Bubble mitlaufen; am Ende `setDragMs(null)` und `onScrubMs?.(null)`.
- Momentum-rAF in einem Ref halten; in `onDown`, `onKeyDown`, bei `playing`-Wechsel und im Unmount-Cleanup abbrechen.
- Strip-`transition` bleibt während des Momentums deaktiviert (gleiche Bedingung wie `dragging`), damit die rAF-Bewegung nicht doppelt geglättet wird.
