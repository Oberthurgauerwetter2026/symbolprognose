## Ziel

Die "Romanshorn"-Pill auf der Region-Karte (`/karten/region`) soll visuell leicht nach Osten verschoben werden, ohne dass sich der Standort für den Wetterabruf ändert.

## Änderungen

1. **`src/data/spots.ts`**
   - Optionales Feld am `Spot`-Typ ergänzen: `markerLatOffset?: number; markerLonOffset?: number;` (Grad). Reine Anzeige-Offsets, beeinflussen nicht den Forecast-Request.
   - Bei Romanshorn `markerLonOffset: 0.012` setzen (≈ +900 m östlich; entspricht einer dezenten Pill-Verschiebung Richtung Hafen/See).

2. **`src/components/region-map.tsx`**
   - In `SpotMarker` die Marker-`position` von `[spot.lat, spot.lon]` auf
     `[spot.lat + (spot.markerLatOffset ?? 0), spot.lon + (spot.markerLonOffset ?? 0)]` ändern.
   - Alle übrigen Datenzugriffe (Forecast-Batch via `getAggregatedForecastBatch`) bleiben unverändert und nutzen die unveränderten `lat`/`lon`.

## Nicht betroffen

- Forecast-Aggregation, Batch-Request, andere Spots, Slider, Tabs.
- Andere Karten/Embeds (nur `region-map.tsx` liest diese Offsets aktuell).
