# Play startet nicht mehr nach manuellem Ziehen im Filmstrip

## Befund (im Browser reproduziert)

Nach einem Zieh-/Wisch-Vorgang im Filmstrip bleibt die Zeitanzeige stehen: aria-Wert und Zeitblase blieben im Test bei „Prognose: Mi, 10:00“ bzw. Schritt 72, auch 3,5 Sekunden nach dem Druck auf Play.

Ursache: Beim kinetischen Nachlaufen (Momentum) wird die Schleife beim Druck auf Play sofort abgebrochen — aber ohne den Zieh-Zustand aufzuräumen. Dadurch bleibt

- im Filmstrip die „gezogene Zeit“ dauerhaft gesetzt (die Anzeige rastet weiter auf diesen Wert statt auf die Playback-Zeit), und
- im Radar die „Scrub-Zeit“ dauerhaft gesetzt, die im Radar Vorrang vor der Playback-Zeit hat — Karte und Streifen bleiben deshalb eingefroren, obwohl der Play-Loop läuft.

## Was sich ändert

- Wird das Nachlaufen abgebrochen (Play gedrückt, neues Antippen, Tastatur, Ausblenden der Komponente), wird der Zieh-Zustand korrekt beendet: die aktuelle Position wird als endgültige Auswahl gemeldet und die Scrub-Zeit wieder freigegeben.
- Beim Start von Play wird im Radar zusätzlich die Scrub-Zeit zurückgesetzt, damit Playback immer Vorrang hat.
- Ergebnis: Play startet und läuft auch direkt nach einem Wisch oder mitten im Nachlaufen, in Niederschlagsradar und Windprognose.

## Technische Details

`src/components/maps/filmstrip-timeline.tsx`
- `stopMomentum()` erweitern: rAF abbrechen, `snapAndEmit(letzte Momentum-Position)`, `setDragMs(null)`, `onScrubMs?.(null)`, `velRef = 0`. Letzte Position in einem Ref mitführen.
- `onDown` nutzt weiter `stopMomentum()`, muss aber danach den neuen Drag setzen (Reihenfolge beibehalten, damit der Reset den neuen Drag nicht überschreibt).
- Unmount-Cleanup nur abbrechen (kein State-Update nach Unmount).

`src/components/maps/radar-map.tsx`
- Im Play-Effekt beim Start `setScrubVisualMs(null)` setzen, nachdem `startMs` aus dem aktuellen Stand berechnet wurde.

Keine Änderungen an Daten, Backend oder Wind-Logik (Wind profitiert automatisch über die gemeinsame Filmstrip-Komponente).
