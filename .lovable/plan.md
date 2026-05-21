## Klick auf Wochentag → Tagesübersicht öffnen

Aktuell ändert ein Klick auf einen Wochentag-Button in `src/components/region-map.tsx` nur den `stepOffset` des Sliders. Neu soll der Klick die **Tagesübersicht** (`/`, `WeatherWidget`) öffnen und dort direkt den gewählten Tag selektieren.

### 1. `src/routes/index.tsx`
- `validateSearch` ergänzen: `{ day?: number }` (0–6, sonst `undefined`).
- Per `Route.useSearch()` `day` lesen und an `<WeatherWidget initialDayIdx={day} />` weitergeben.

### 2. `src/components/weather-widget.tsx`
- Neue Prop `initialDayIdx?: number`.
- `useState(0)` → `useState(initialDayIdx ?? 0)` für `selectedDayIdx`.
- Bei Änderung von `initialDayIdx` (z. B. erneuter Aufruf mit anderem Param) per `useEffect` synchronisieren, sofern Wert im gültigen Bereich.

### 3. `src/components/region-map.tsx`
- Wochentag-Button: `onClick` setzt **nicht mehr** `stepOffset`, sondern navigiert:
  `router.navigate({ to: "/", search: { day: i } })`.
- Fallback wie `goHome` (Hard-Navigation bei Fehler).
- `reachable`-Check entfällt — alle 7 Tage sind in der Tagesübersicht erreichbar; `disabled`/`opacity-40` Styling entfällt.
- Slider/`stepOffset` bleiben für Marker-Aktualisierung auf der Karte unverändert.

### Unverändert
- Marker-Klick navigiert weiterhin nach `/` (ohne `day`).
- Karten-Layer, Slider, Stundenlegende, Tag/Nacht-Logik.

