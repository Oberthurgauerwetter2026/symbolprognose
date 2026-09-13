# Tageskacheln folgen der Stundenprognose beim Scrollen

## Befund

Beim horizontalen Scrollen der Stundenprognose wechselt die Markierung in der Tagesleiste bereits mit (`onVisibleDayChange` → `setSelectedDayIdx` in `src/components/weather-widget.tsx`). Die Tagesleiste selbst scrollt aber nicht mit: Wechselt die Stundenansicht auf einen Tag, dessen Kachel ausserhalb des sichtbaren Bereichs liegt (z. B. Tag 5–7 auf dem Handy), bleibt die markierte Kachel unsichtbar.

## Änderung

1. **Tagesleiste scrollt ausgewählte Kachel ins Bild:** In `DayStrip` bekommt jede Kachel einen Ref. Ändert sich `selectedIdx` und die gewählte Kachel ist nicht vollständig sichtbar, scrollt die Leiste sie sanft an den nächstgelegenen Rand (`scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" })`) — nur horizontal, die Seite bewegt sich nicht vertikal.
2. **Nur bei Bedarf scrollen:** Ist die Kachel schon komplett sichtbar, passiert nichts (kein unnötiges Hin- und Her-Ruckeln beim Wechsel zwischen sichtbaren Tagen).
3. **Klick bleibt unverändert:** Tippt der User direkt eine Kachel an, bleibt das bisherige Verhalten (Stundenpanel scrollt zum Tag) bestehen; die Leiste scrollt höchstens minimal nach, falls die angetippte Kachel abgeschnitten war.
4. Keine Änderung an Daten, Auswahllogik oder Layout der Kacheln.

## Technische Details

- `src/components/weather-widget.tsx`, `DayStrip` (~Zeile 774): `tileRefs = useRef<Map<number, HTMLButtonElement>>` und ein `useEffect` auf `selectedIdx`, der Sichtbarkeit prüft (`offsetLeft`/`offsetWidth` gegen `scrollLeft`/Breite des Scrollers) und nur bei Bedarf scrollt.
- Bestehender `scrollerRef` der Tagesleiste wird wiederverwendet; `ScrollEdgeShadows` reagiert automatisch auf die neue Scrollposition.

## Prüfung

- Typecheck und Build.
- Browser-Test (mobiler Viewport): Stundenprognose bis zum nächsten/übernächsten Tag scrollen → Markierung wechselt und die neue Tageskachel wird sichtbar eingerollt; Seite bleibt vertikal ruhig.
