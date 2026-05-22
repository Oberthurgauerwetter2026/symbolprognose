## Ziel

Ab Tag 6 wird DWD-MOSMIX zur **priorisierten Hauptquelle** (nicht mehr nur Lückenfüller). Es werden ausschließlich die Stationen **Güttingen (06621)** und **Bischofszell (06678)** verwendet — die nächstgelegene der beiden je nach Spot.

## Änderungen

### 1. `src/lib/mosmix.functions.ts`
- Eigene Stations-Whitelist `ALLOWED = ["06621", "06678"]` direkt im Modul.
- Statt `nearestMosmixStation(...)` → eigene Auswahl: die geographisch nähere der beiden erlaubten Stationen zum gegebenen Spot.
- Distanz-Cutoff (60 km) entfällt bzw. wird auf z. B. 80 km gelockert, damit beide Stationen für alle vier Spots garantiert greifen (Horn, Amriswil, Sitterdorf, Münsterlingen liegen alle < 25 km von einer der beiden).

### 2. `src/lib/weather.ts` — `fetchForecast()`
Neue Merge-Reihenfolge in der Zeitachse:

```text
Stunde 0–24h   : ICON-CH1-EPS  (Primär)
Stunde 24–120h : ICON-CH2-EPS  (Lückenfüller)
Stunde 120h+   : MOSMIX        (Primär ab Tag 6, ÜBERSCHREIBT IFS/best_match)
Restlücken     : IFS, best_match
```

Konkret:
- Neue Hilfsfunktion `overwriteFromIndex(primary, source, fromIndex)`: kopiert ab `fromIndex` **alle** vorhandenen (finiten) Werte aus `source` in `primary` — auch wenn `primary` dort schon Werte hat. Lücken in `source` bleiben unverändert.
- Aufrufreihenfolge in `fetchForecast`:
  1. `primary` = CH1 (oder Fallback-Kette wie bisher)
  2. `fillGaps` mit CH2
  3. **`overwriteFromIndex` mit MOSMIX ab Index `5*24`** (statt heutigem `fillGaps`)
  4. `fillGaps` mit IFS (füllt nur, was MOSMIX nicht hatte)
  5. `fillGaps` mit `best_match` (Restfelder wie `precipitation_probability`, `sunrise`/`sunset`)
- Daily-Aggregation aus dem neuen Hourly-Mix bleibt unverändert (passiert ohnehin schon nach allen Merges).

### 3. Keine UI-Änderungen
Region-Map, Lokalprognose, Marker-Pills bleiben unberührt — sie konsumieren weiterhin `ForecastResponse`.

## Auswirkung pro Spot

| Spot | Nächste erlaubte Station | Distanz ca. |
|---|---|---|
| Horn | Güttingen | ~6 km |
| Münsterlingen | Güttingen | ~5 km |
| Amriswil | Bischofszell oder Güttingen | ~9 km / ~10 km |
| Sitterdorf | Bischofszell | ~6 km |

Tag 6–7 stammt damit für alle Spots aus einer DWD-Station < 10 km.

## Nicht enthalten
- Keine Änderung an Open-Meteo-Modellauswahl für Tag 0–5.
- Keine Änderung an Tag-Aggregation, Symbol-Mapping, oder Cache.
- Kein neuer Daten-Quellen-Indikator in der UI (kann separat ergänzt werden, wenn gewünscht).