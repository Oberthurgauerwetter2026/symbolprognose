## 1. Fehlende Daten in Kacheln & Tagesübersicht

`src/components/weather-widget.tsx`:

- **`DayRainSparkline`**: kleine Regenmengen (< 0.25 mm) ergeben mit `Math.min(mm/5,1)*100` Balken < 4 % der 14-px-Höhe und wirken leer. Fix:
  - `minHeight` für mm > 0 von 1 → 2 px
  - Balkenhöhe für mm > 0 auf mindestens 12 % floor’en
  - Containerhöhe von `h-3.5` → `h-4` (16 px), damit auch volle Balken erkennbar sind
- **`DaySummaryBar`**:
  - `formatTimeHHMM(d.sunrise?.[i] ?? "")` → wenn leer, „–" anzeigen statt leeren String
  - `windgusts_10m_max` Fallback auf `Math.round(wind * 1.4)`, wenn 0 oder undefined (MOSMIX-Tage liefern teilweise keine Böen)
  - Falls `sunshine_duration` 0/undefined ist (Tag 6–10 aus MOSMIX), „–" statt „0 h"

## 2. Panel folgt Tagesauswahl wieder

Neues Verhalten: Klick auf eine Kachel im Strip → Detail-Panel scrollt smooth zum ersten Slot (00:00 bzw. erster verfügbarer) des gewählten Tages. Scrollen im Panel selbst markiert weiterhin den sichtbaren Tag im Strip, löst aber **keinen** Re-Scroll aus.

Umsetzung:

- In `WeatherWidget` zweiten State `panelTargetTick` (Zähler) plus `panelTargetDayIdx` einführen. `DayStrip.onSelect(i)` setzt `setSelectedDayIdx(i)` **und** `setPanelTargetDayIdx(i); setPanelTargetTick(t => t+1)`.
- `DetailPanel` bekommt `targetDayIdx` und `targetTick` als Props. Ein `useEffect` mit Dep `[targetTick]` führt den smooth-Scroll auf den ersten Slot von `days[targetDayIdx]` aus (gleiche Logik wie zuvor entfernt).
- Initial-Mount-Scroll zur aktuellen Stunde bleibt, greift nur wenn `targetTick === 0`.
- `onVisibleDayChange` (vom Panel-Scroll ausgelöst) setzt **nur** `selectedDayIdx`, nicht `panelTargetTick` — Strip-Highlight folgt, kein Auto-Re-Scroll.

## 3. Unverändert

Kachel-Aufbau (Wochentag / Datum / Icon / min|max / mm + % + Sparkline), DaySummaryBar-Felder/Layout, alle Datenquellen, Server-Funktionen.

## Test

`browser--view_preview /karten/lokal` mit Ortung, mehrere Tage durchklicken (Panel scrollt mit), dann manuell scrollen (Strip-Highlight folgt, Panel scrollt nicht zurück), Sparkline und Sun/Wind in der Übersicht prüfen.
