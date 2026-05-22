# Zeitschieberegler 24 h + Pills kompakter + Mobile

## 1) Slider auf rollierende 24 h begrenzen (`src/components/region-map.tsx`)

- `MAX_STEPS` von `56` → `8` (8 × 3 h = 24 h Fenster, beginnend bei der aktuellen Stunde).
- `baseHour` aktuell nur beim Mount gesetzt → **nachrücken**: per `useEffect` einen Timer setzen, der jede Minute prüft, ob `currentBaseHour()` sich geändert hat, und `baseHour` updated. Wenn `baseHour` vorrückt: `stepOffset` so anpassen, dass die vom Nutzer gewählte absolute Stunde erhalten bleibt, solange sie noch im neuen 24h-Fenster liegt — sonst auf `0` (jetzt) zurücksetzen.
- `baseHour` deshalb zu echtem `useState` mit Setter machen (statt const-Init).
- Footer-Label `+{Math.round((MAX_STEPS * 3) / 24)} Tage` → `+24 Std`.
- Die Wochentag-Pills (Heute/Morgen/…) bleiben unverändert — Tagesansicht funktioniert weiterhin über `viewMode="daily"`. Beim Wechsel zurück nach „Stündlich" wird `stepOffset` auf `0` gesetzt (Code stimmt schon, da `selectedDayIdx*24 − baseHour` jetzt fast immer > MAX_STEPS ist → wird auf 0..7 geclamped; ggf. einfach immer `setStepOffset(0)` beim Toggle in „hourly").

## 2) Marker-Pills etwas kleiner (`MarkerPill` + `SpotMarker.icon`)

- Padding `10px 16px 10px 10px` → `6px 12px 6px 6px`
- Icon-Kreis `52×52` → `40×40`, `WeatherIcon size={40}` → `size={30}`
- Name `fontSize 17` → `14`
- Temp-Badges `padding 3px 10px` → `2px 7px`, `fontSize 14` → `12`, gap `6` → `4`
- Äußerer `gap 12` → `8`, Spalten-`gap 5` → `3`
- `iconSize [240,80]` → `[190,60]`, `iconAnchor [120,40]` → `[95,30]`
- Loading-Stub-Pill ebenfalls leicht verkleinern (`fontSize 13` → `12`, `padding 6px 12px` → `4px 9px`).

## 3) Smartphone-Optimierung

- **Kartenhöhe** `h-[600px]` responsive: `h-[420px] sm:h-[600px]`.
- **Tages-Toggle-Leiste** (`inline-flex w-full gap-1 …`): auf Mobile horizontal scrollbar machen — `overflow-x-auto no-scrollbar`, Buttons `shrink-0`, kleinere Paddings (`px-2 sm:px-3`, `text-xs sm:text-sm`).
- **Stündlich-Button**-Label auf Mobile nur Icon (Text `hidden sm:inline`), bleibt aber sichtbar als runder Button.
- **Slider-Card** Paddings bereits `p-3` — Mobile-Größen für Header (`text-base sm:text-lg`) und Stunden-Tick-Labels (`text-[9px] sm:text-[10px]`).
- **Pills auf Mobile** zusätzlich nochmal kompakter via Detect: nicht nötig wenn Schritt 2 sie generell schon kleiner macht; falls auf 320 px doch zu groß, später iterieren.
- `preview_ui--set_preview_device_viewport` auf `mobile` setzen, um nach Implementierung visuell zu prüfen.

## Aus Scope

- Keine Änderungen an Datenfluss, `fetchForecast`, Geo-/Tile-Layern, Wochentag-Logik der Tagesansicht.
- Keine Design-Token-/Farbänderungen.
