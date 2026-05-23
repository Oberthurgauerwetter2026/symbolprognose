## Pill-Klick → Lokalprognose des Ortes

### 1. `src/routes/karten.lokal.tsx`
Search-Schema erweitern um optionale `lat`, `lon`, `name` und an `WeatherWidget` durchreichen:
```ts
const searchSchema = z.object({
  day: fallback(z.number().int().min(0).max(6).optional(), undefined).optional(),
  lat: fallback(z.number().optional(), undefined).optional(),
  lon: fallback(z.number().optional(), undefined).optional(),
  name: fallback(z.string().optional(), undefined).optional(),
});
```
`<WeatherWidget initialDayIdx={day} initialLocation={lat && lon && name ? { name, latitude: lat, longitude: lon } : undefined} />`

### 2. `src/components/weather-widget.tsx`
- Neue Prop `initialLocation?: { name; latitude; longitude }`.
- Initialer `location`-State: wenn `initialLocation` gesetzt → diese verwenden, sonst localStorage/Default.
- `useEffect` auf `initialLocation` → bei Änderung `setLocation(initialLocation)` und `setSelectedDayIdx(0)`.

### 3. `src/components/region-map.tsx`
- `goHome` ersetzen durch `goToLokal(spot: Spot)` → `router.navigate({ to: "/karten/lokal", search: { lat: spot.lat, lon: spot.lon, name: spot.name } })`.
- In der `SPOTS.map(...)`-Schleife: `onClick={() => goToLokal(s)}`.

Keine weiteren Änderungen. Mobile/Responsive bleibt unverändert.