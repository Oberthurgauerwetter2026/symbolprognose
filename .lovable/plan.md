## Gewitter-Vorrang im Tagessymbol

**`src/components/weather-icons/index.tsx`**
- Neuen Prop `thunderHours?: number` an `WeatherIcon`.
- Daily-Override direkt nach `wmoIsWet`: wenn `scope==="daily"` und (`thunderHours ≥ 1` oder Code ∈ {95,96,99}) → `IconThunderstorm`. Steht vor allen anderen Wet-Pfaden.

**`src/lib/weather.ts`**
- `DailyData`-Typ: `thunderstorm_hours: number[]` ergänzen.
- `aggregateDailyFromHourly` gibt `thunderstorm_hours` (bereits berechnetes `thunderHours`) zurück.
- Im Daily-Apply-Loop und in `ensureLen`-Keyliste `thunderstorm_hours` aufnehmen.

**`src/components/weather-widget.tsx` + `src/components/region-map.tsx`**
- `thunderHours={d.thunderstorm_hours?.[i]}` an `WeatherIcon` durchreichen.

**Cache:** `v7` → `v8` in `weather-widget.tsx` und `region-map.tsx`.

**Verifikation:** Tag mit 1h Gewittercode → IconThunderstorm; sonst unverändert.
