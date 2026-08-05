Filmstrip: Natürlichere Inertia-Bremse beim Loslassen

## Ziel
Das kinetische Scrollen des Filmstrips soll sich beim Loslassen immer gleichmässig und ruckelfrei abbremsen. Die aktuelle reibungsbasierte Abbremsung führt zu unterschiedlichen Auslaufzeiten und zu merklichem Ruckeln, weil während des Nachlaufens bereits auf Frames gesnappt wird.

## Änderung
- Datei: `src/components/maps/filmstrip-timeline.tsx`
- Betroffene Komponente: `FilmstripTimeline`

Konkrete Anpassungen:
  1. **Konstante Abbremsrate statt Reibungsfaktor**
     - Ersetze den exponentiellen Reibungsansatz (`v *= pow(FRICTION, dt/16.67)`) durch eine feste Verzögerung, z. B. `DECELERATION_MS = 0.0015 ms Zeitachse pro ms Realzeit²`.
     - Das garantiert, dass ein Loslassen mit gleicher Anfangsgeschwindigkeit immer gleich lang ausläuft, unabhängig von der Framerate.

  2. **Kein Snapping während des Nachlaufens**
     - `snapAndEmit()` wird nur noch einmal beim finalen Stillstand aufgerufen, nicht in jedem Frame der Momentum-Schleife.
     - Während des Nachlaufens wird nur `setDragMs(ms)` und `onScrubMs?.(ms)` aktualisiert, damit die Karte flüssig weitermorpht, ohne auf die nächste echte Frame-Zeit zu springen.

  3. **Bessere Geschwindigkeitserfassung**
     - Vereinfache die Glättung: speichere die letzten 2–3 Bewegungsdeltas und bilde den gleitenden Mittelwert.
     - Ignoriere Bewegungsdeltas unter einem sehr kleinen Zeitschwelle (z. B. < 8 ms), um Ausreisser bei schnellen Events zu vermeiden.

  4. **Konsistente Stopp-Logik**
     - Stoppe die Momentum-Schleife, sobald die Geschwindigkeit unter `MIN_V` fällt oder eine Grenze (`tMin`/`tMax`) erreicht wird.
     - Dann einmalig `snapAndEmit(ms)`, gefolgt von `setDragMs(null)` und `onScrubMs?.(null)`.

  5. **Keine Doppel-Animationen**
     - Solange `dragMs !== null` (Nachlauf aktiv), bleibt die CSS-Transition auf dem Strip ausgeschaltet (`transition: none`), damit der bewegte Strip exakt der berechneten Position folgt.

## Nicht im Scope
- Keine Änderung des grundlegenden Zieh- oder Pointer-Event-Modells.
- Keine Änderung der Haptik-Logik oder der Tastaturbedienung.
- Keine Änderung der Zeitformatierung, Bubble-Grösse oder Farbgebung.
