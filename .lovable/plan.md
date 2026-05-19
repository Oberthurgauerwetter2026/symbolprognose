# Problem

Beim Klick auf einen Tag in der 5-Tage-Übersicht passiert (sichtbar) nichts: Der programmgesteuerte Smooth-Scroll im Detail-Panel löst sofort `scroll`-Events aus, der Handler ruft `onVisibleDayChange(...)` für jeden Zwischen-Tag auf, und der ausgewählte Index springt zurück auf den aktuell sichtbaren (meist heute). Das Klick-Update wird dadurch überschrieben.

Im Code (`src/components/weather-widget.tsx`, Zeilen 432–476):
- `useEffect` auf `selectedDayIdx` setzt `userScrolling.current = false` und startet smooth scroll.
- Der `onScroll`-Handler setzt aber bei *jedem* Event sofort `userScrolling.current = true` und meldet den sichtbaren Tag — die Flag wird also nie effektiv genutzt.

# Fix (nur Detail-Panel-Scroll-Logik)

In `src/components/weather-widget.tsx`:

1. **Programmatisches Scrollen markieren.** Beim Tag-Klick (Effect auf `selectedDayIdx`) `userScrolling.current = false` setzen und einen Timer starten (~600 ms), nach dem wieder auf `true` gewechselt wird. Während dieser Zeit ignoriert `onScroll` jegliche `onVisibleDayChange`-Aufrufe.

2. **`onScroll` korrigieren.** Nicht mehr bei jedem Event blind `userScrolling.current = true` setzen. Stattdessen: wenn `userScrolling.current === false`, früh aussteigen (programmatischer Scroll). Nur bei echtem User-Scroll (z. B. Wheel/Touch) den sichtbaren Tag melden.

3. **User-Scroll erkennen.** `wheel`-, `touchstart`- und `pointerdown`-Listener auf dem Scroller setzen `userScrolling.current = true`, damit der bestehende Auto-Update-beim-Scrollen-Mechanismus weiterhin funktioniert.

4. Aufräumen der Timer/Listener in `useEffect`-Cleanup.

# Was nicht geändert wird

- DayStrip, Styling, Wetter-Daten, Layout, Reihenfolge der Tage.
- Verhalten beim manuellen Scrollen (synchronisiert weiter den DayStrip).

Nach dem Fix: Klick auf einen Tag → Detail-Panel scrollt zu diesem Tag, Auswahl bleibt korrekt. Manuelles Scrollen aktualisiert weiterhin den selektierten Tag.