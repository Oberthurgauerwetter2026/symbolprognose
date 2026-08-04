# Haptik-Feedback im Filmstrip ausbauen

## Ziel

Das bestehende, kurze Vibrieren beim Antippen des Filmstrips soll zu einem sinnvollen, rückmeldenden Scrubbing-Feedback ausgebaut werden — ohne aufdringlich zu wirken.

## Aktueller Zustand

In `src/components/maps/filmstrip-timeline.tsx` gibt es bereits beim Start eines Drag-Events (`onPointerDown`) einen kurzen `navigator.vibrate(6)` Aufruf. Beim Bewegen oder bei Raster-Übergängen erfolgt jedoch noch keine Haptik.

## Geplante Änderungen

- **Haptik beim Raster-Schritt während des Scrubbens**
  - Wenn der Benutzer während des Drag- oder Keyboard-Steps einen neuen Frame-Index erreicht, wird eine kurze, dezente Vibration ausgelöst.
  - Messungs-Bereich (5-Minuten-Schritte): kurzes leises Tick, z. B. `navigator.vibrate(4)`.
  - Prognose-Bereich (60-Minuten-Schritte): etwas spürbarerer Impuls, z. B. `navigator.vibrate(8)`.
  - Tageswechsel: leicht zweiteiliger Rhythmus, z. B. `navigator.vibrate([10, 30, 15])`, damit Mitternacht spürbar ist.

- **Keine Doppel-Vibrationen**
  - Durch Ref-Vergleich (`lastHapticIdx`) wird verhindert, dass derselbe Index mehrfach vibriert, wenn der Finger stillhält oder zwischen zwei Punkten hin- und herpendelt.

- **Fallback & Respektierung**
  - Prüfung auf `typeof navigator !== "undefined" && "vibrate" in navigator` bleibt erhalten.
  - Haptik wird nur bei Touch- oder Pen-Interaktion ausgelöst (optional via `window.matchMedia('(pointer: coarse)')` beschränkt), um Desktop-Nutzer mit Maus nicht zu irritieren.
  - Tritt ein Fehler bei `vibrate()` auf, wird stillschweigend abgefangen.

- **Betroffene Dateien**
  - `src/components/maps/filmstrip-timeline.tsx` — Haptik-Logik während `onMove`, `onKeyDown` und `onDown`.
  - Ggf. `src/components/maps/radar-map.tsx` — falls die Haptik-Intensität aus dem übergeordneten Radar-Modus (Messung vs. Prognose) gesteuert werden soll.

## Nicht enthalten

- Keine Soundeffekte.
- Keine Haptik beim automatischen Abspielen (Play-Modus), weil die Animation dort nicht durch Benutzerinteraktion getriggert wird.
- Keine Änderungen am Zeitraster oder an der visuellen Darstellung des Filmstrips.

## Validierung

- Preview auf einem Touch-Gerät (oder mit Chrome DevTools Sensor-Vibration) testen: Scrubben durch Messung und Prognose spürt sich unterschiedlich an.
- Auf Desktop mit Maus: keine Vibrationen.
