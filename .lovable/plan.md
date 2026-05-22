## Problem

Auf `/karten/region` zeigt Tag 6/7 nach Reload weiterhin die alten Werte ohne MOSMIX-Einfluss, obwohl die MOSMIX-Integration serverseitig korrekt arbeitet (verifiziert in Sandbox-Logs: `HTTP 200`, 247 Steps, Stationen 06621/06678).

**Root Cause:** `src/routes/__root.tsx` umhüllt die App mit `PersistQueryClientProvider`, der den TanStack-Query-Cache 1 h im `localStorage` unter `wx-rq-cache-v1` (buster `"v1"`) ablegt. Der `useQuery({ queryKey: ["map-weather", spot.id], staleTime: 30 min })` in `src/components/region-map.tsx` greift nach einem Reload auf diesen persistierten Eintrag zu und ruft `fetchForecast` gar nicht erst neu auf — der MOSMIX-Code wird übersprungen.

## Fix

**Buster hochzählen** in `src/routes/__root.tsx`:

```diff
- buster: "v1",
+ buster: "v2-mosmix",
```

Das macht den bisher persistierten Cache schlagartig ungültig. Beim nächsten Reload wird `fetchForecast` neu ausgeführt, MOSMIX wird abgeholt und Tag 6/7 zeigt die neuen Werte. Ab dann läuft alles wie gewohnt (1 h Persistenz, 30 min staleTime).

Kein anderer Code muss geändert werden — `weather.ts` und `mosmix.functions.ts` sind bereits korrekt.

## Verifikation

1. Reload auf `/karten/region` — Console sollte keine alten persistierten Daten zeigen.
2. Sandbox-Server-Logs zeigen frische `[MOSMIX] HTTP 200`-Einträge (passiert bereits jetzt schon).
3. Slider auf Tag 6 oder 7: Temperatur/Symbol weichen jetzt von den vorher gezeigten Werten ab (im letzten Test z. B. Güttingen Tag 6 12:00 von 25,4 → 23,9 °C).

## Hinweis für später

Wenn künftig Änderungen an `fetchForecast` / `weather.ts` / `mosmix.functions.ts` vorgenommen werden, muss der `buster`-String erneut erhöht werden (`"v3-…"`, `"v4-…"` etc.), sonst tritt das gleiche Problem wieder auf. Alternativ könnten wir den Buster automatisch aus einem Build-Hash ableiten — das wäre eine separate Aufgabe.