# Zeitschieberegler: Start bei aktueller Stunde

Aktuell rundet `currentBaseHour()` auf den nächsten 3-h-Slot **ab** (14:30 → 12:00). Der Slider startet damit bis zu 2 h in der Vergangenheit.

## Änderung in `src/components/region-map.tsx`

- `currentBaseHour()` → einfach `new Date().getHours()` (volle aktuelle Stunde, also die zuletzt abgelaufene Stunde).
- Slider auf **1-Stunden-Schritte** statt 3-h-Schritte:
  - `MAX_STEPS = 24` (24 × 1 h = 24-h-Fenster).
  - `absoluteHour = baseHour + stepOffset` (statt `* 3`).
  - Nachrück-Logik im Interval: `newOffset = absolute - next` (statt `/ 3`).
- Stundenlegende (`HOUR_TICKS`) bleibt `[0,3,6,…,24]` als visuelle Ticks — sie zeigt Tageszeit-Ankerpunkte, unabhängig von der Schrittweite. Aktiv-Hervorhebung anpassen: `h === hourOfDay` (statt `Math.floor(hourOfDay/3)*3`).
- Footer „+24 Std" bleibt.

## Aus Scope

- Keine Änderungen an Pills, Karte, Daten-Fetching, Tagesansicht.
