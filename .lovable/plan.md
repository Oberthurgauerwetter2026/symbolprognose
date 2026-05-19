## Änderungen in `src/components/weather-widget.tsx`

### 1. Tagesübersicht: 5 sichtbar, Rest per Swipe/Scroll
- Auto-Roll vollständig entfernen (`setInterval`, `pausedUntil`, alle Pause-Listener im `DayStrip`).
- Layout bleibt **flex + snap-x + overflow-x-auto**; jede Karte fix auf `basis-[calc(20%-1px)]` ab `@[900px]` → 5 Karten füllen die Breite exakt, Tag 6/7 erscheinen per Swipe/Scroll.
- Tageskarten bleiben klickbar (Tageswahl für Detail-Panel).
- `cardRefs` und `scrollerRef` entfernen, da nicht mehr benötigt.
- `SkeletonWidget`: 5 Platzhalter (bereits so), `grid-cols-5` bleibt.

### 2. Footer-Legende
- „Grafik & Daten © …" → **„Grafik © oberthurgauerwetter.ch"** (Link bleibt).

### Hinweis zu Sonntag/Montag
- Sind in den API-Daten enthalten (7 Tage MeteoSchweiz `icon_seamless`). Sichtbar nach Swipe/Scroll nach rechts. Keine Datenanpassung nötig.

## Nicht enthalten
- Keine Änderung an `src/lib/weather.ts`.
- Keine weiteren UI-/Theme-Änderungen.
