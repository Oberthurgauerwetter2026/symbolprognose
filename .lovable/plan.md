## Änderung

**Detailansicht-Kopfzeile**: Statt nur "Detailansicht" den Wochentag des aktuell sichtbaren Tages anzeigen (ohne Datum) — z.B. "Heute", "Morgen" oder "Samstag". Wert kommt aus `selectedDayIdx` + `days[selectedDayIdx].date` (wird beim Scrollen bereits live aktualisiert via `onVisibleDayChange`).

**Tages-Slots**: Das `isDayStart`-Label (Wochentag + Datum, das beim ersten Slot eines neuen Tages — meist 00:00 — angezeigt wird) komplett entfernen. Der farbige Akzent-Border-Left bleibt als visueller Tagestrenner bestehen.

## Technische Details

In `src/components/weather-widget.tsx`, `DetailPanel`:
- Header-Span: `Detailansicht` → `selectedDayIdx === 0 ? "Heute" : selectedDayIdx === 1 ? "Morgen" : weekdayLong(selectedDay.date)`
- Slot-Render: den `{isDayStart && <div>...</div>}`-Block löschen
- `isDayStart` selbst weiterhin für die Border-Klasse verwenden — Variable bleibt nötig
