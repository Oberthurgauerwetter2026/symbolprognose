## Ziel

Klick auf einen Wochentag in der Karte aktiviert einen **Tagesübersicht-Modus**: Marker zeigen die Tageshöchst-/Tiefstwerte und das dominierende Wettersymbol des ganzen Tages, statt den Wert eines 3-h-Slots. Der stündliche Slider wird in diesem Modus deaktiviert. Über einen "Stündlich"-Button kehrt der Nutzer in den Slider-Modus zurück.

## Änderungen — `src/components/region-map.tsx`

### State

- Neuer State: `viewMode: "hourly" | "daily"`, initial `"hourly"`.
- `stepOffset` und `baseHour` bleiben; im `daily`-Modus wird `stepOffset` nicht benutzt.
- Neuer State: `selectedDayIdx` (0–6); im `hourly`-Modus aus `dayIndex` abgeleitet.

### Wochentag-Buttons

- Klick → `setViewMode("daily")`, `setSelectedDayIdx(i)`. Kein Setzen von `stepOffset`.
- Aktiver Button: im `daily`-Modus `selectedDayIdx`, sonst `dayIndex` (wie heute).

### Marker (`SpotMarker`)

- Neue Props: `mode: "hourly" | "daily"`, `dayIdx: number` (für daily), bestehende `absoluteHour`/`isDay` nur für `hourly`.
- Im `daily`-Modus:
  - `code = data.daily.weathercode[dayIdx]` (repräsentatives Tagessymbol von Open-Meteo)
  - `tMin = data.daily.temperature_2m_min[dayIdx]`, `tMax = data.daily.temperature_2m_max[dayIdx]`
  - `isDay = true` (Tag-Symbolik fix, da Tagesübersicht)
- Im `hourly`-Modus: unverändert.

### Slider-Bereich

- Header: zeigt im `daily`-Modus "Tagesübersicht" statt Stunden-Pill; im `hourly`-Modus unverändert.
- Slider wird im `daily`-Modus `disabled` (visuell ausgegraut via `opacity-50 pointer-events-none`) und Stundenlegende ebenso.
- Zusätzlich Button "Stündliche Ansicht" rechts neben Header: wechselt zurück in `hourly`-Modus (`setViewMode("hourly")`, `stepOffset` auf Tagesanfang des `selectedDayIdx` setzen).

### Unverändert

- 7-Tage-Leiste, Marker-Klick navigiert weiterhin zur Symbolprognose, Relief, Karten-Layer, `?day=`-Param-Unterstützung im WeatherWidget.

## Technische Hinweise

- Open-Meteo liefert in `daily`: `weathercode`, `temperature_2m_min`, `temperature_2m_max` pro Tag — bereits abgefragt (`data.daily.*` wird im Code schon verwendet).
- Memoization der Icons muss `mode` und `dayIdx` als Deps enthalten.
