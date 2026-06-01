## Ziel
429-Fehler beheben, indem das Frontend Open-Meteo nicht mehr direkt aufruft. Der bereits vorhandene serverFn `getAggregatedForecast` wird zur einzigen Quelle für die Symbolprognose. Dadurch:
- Open-Meteo sieht nur noch Worker-IPs statt jeder Besucher-IP.
- Edge-Cache (`s-maxage=900`) bündelt Requests pro Spot.
- Die bestehende Multi-Modell-Logik (ICON-CH1/CH2, IFS, MOSMIX, best_match) und die neue Cloud-Layer-Heuristik bleiben unverändert.

## Änderungen

1. **`src/components/weather-widget.tsx`**
   - Import `fetchForecast` → entfernen.
   - Stattdessen `getAggregatedForecast` aus `@/lib/forecast-aggregated.functions` via `useServerFn(...)` einbinden.
   - `queryFn` ruft das Server-Wrapper-Objekt mit `{ data: { lat, lon } }` auf.

2. **`src/components/region-map.tsx`** (zwei `useQuery`-Stellen: `SpotMarker` ~Z. 264, Lokalprognose-Karte ~Z. 531)
   - Gleiche Umstellung wie oben.

3. **`src/lib/weather.ts`**
   - `fetchForecast` bleibt exportiert, wird aber nur noch serverseitig von `getAggregatedForecast` aufgerufen. Kein Code-Change nötig — nur Kommentar verschärfen („nicht aus dem Browser aufrufen").

4. **Sanity-Check Ingest/Cache**
   - `scripts/ingest_openmeteo.py` enthält bereits `cloud_cover_low/mid/high` → keine Änderung.
   - `getMultiModelForecast` (R2-basiert) bleibt für andere Verbraucher (Karten-Tiles etc.) unangetastet.

## Erwartetes Verhalten nach dem Build
- Browser-Network-Tab zeigt keine Aufrufe mehr an `api.open-meteo.com` / `ensemble-api.open-meteo.com` aus den Wetter-Widgets/Karten — nur noch `/_serverFn/...getAggregatedForecast`.
- Symbolprognose, Regionkarte und stündliche Lokalprognose erhalten wieder Daten.
- Die kürzlich eingeführte Bewölkungs-Heuristik (low/mid/high → IconCloudy, IconMostlyClear, IconPartlyCloudy, IconSunShower) funktioniert unverändert, weil `fetchForecast` die Felder bereits liefert.

## Risiken
- Server-Cold-Start kann den ersten Spot-Request leicht verzögern; danach greift der Edge-Cache.
- Falls Open-Meteo den Worker auch limitiert, ist Phase 2 nötig: alle Aufrufe auf R2 (`getMultiModelForecast`) umstellen. Aktuell nicht Teil dieses Plans.