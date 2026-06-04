# Fix: Daten fehlen ab Mo, 8. Juni in Wetterkarte / Lokalprognose

## Ursache

Der R2-Cache (`openmeteo/symbol.json`) enthält pro Stunde/Tag **mehrere Modell-Spalten** (Suffix `_meteoswiss_icon_ch2`, `_icon_d2`, `_arpege_europe`, `_meteofrance_arome_france_hd`, `_ecmwf_ifs025`, `_gfs_global`). Die hochauflösenden Regional-Modelle reichen nur ~2–5 Tage in die Zukunft, ECMWF/GFS dagegen volle 7 Tage:

```text
temperature_2m_meteoswiss_icon_ch2   117/168 non-null  (≈ bis 9. Juni)
temperature_2m_icon_d2                51/168            (≈ bis 6. Juni)
temperature_2m_arpege_europe          99/168            (≈ bis 8. Juni)
temperature_2m_meteofrance_arome_…    51/168            (≈ bis 6. Juni)
temperature_2m_ecmwf_ifs025          168/168 ✓
temperature_2m_gfs_global            168/168 ✓
```

In `src/lib/forecast-aggregated.functions.ts` wählt `pickArr` jedoch **eine einzige** Modell-Spalte – nach Suffix-Reihenfolge die erste vorhandene. Das ist `meteoswiss_icon_ch2`. Ab dem Zeitpunkt, an dem dieses Modell `null` liefert (≈ ab Mo, 8. Juni), füllt `sanitizeForecast` die Werte mit `0`/`NaN` auf → Temperatur 0°, Wind 0, Code 0 (= „Klar") → für den User sehen die Tage „leer" / falsch aus.

## Lösung

Per-Index-Merge über alle Modelle, statt eine einzelne Modell-Spalte zu wählen. Priorität nach Modellreihenfolge (hochauflösend zuerst, ECMWF/GFS als Lückenfüller).

### `src/lib/forecast-aggregated.functions.ts`

- Neuer Helper `mergeArr(s, ...keys)`:
  - Sammelt für jeden `key` alle vorhandenen Spalten: unsuffigiert + alle `key_<modelSuffix>` in `CACHE_MODEL_SUFFIXES`-Reihenfolge.
  - Bestimmt die Ziel-Länge aus dem längsten Array.
  - Für jeden Index `i`: nimm den ersten finiten Zahlenwert über die Modell-Reihenfolge (priorisiert hochauflösende Modelle, fällt auf ECMWF/GFS zurück). Wenn nichts vorhanden ist, bleibt `null` (wird später von `sanitizeForecast`/`keepNaNArr` korrekt behandelt) bzw. für hourly-Zahlen `0` als sicherer Default.
- Analog `mergeStrArr` für `sunrise`/`sunset` (priorisiert erste nichtleere Zeichenkette pro Tag).
- `buildForecastFromCacheLoc` verwendet `mergeArr` statt `pickArr` für alle Hourly- und Daily-Felder. `time` bleibt unverändert (`pickStrArr`).
- Padding-Aufrufe (`padNum`/`padStr`) bleiben als Sicherheitsnetz für Schemafehler.

### Keine weiteren Änderungen

- Keine UI/Design-Änderungen.
- Keine Änderungen am Ingest-Workflow oder R2-Schema.
- `getMultiModelForecast`, `radar.functions.ts`, `weather.ts` bleiben unverändert.

## Verifikation

1. Server-Fn-Test für Amriswil: `hourly.temperature_2m[i]` und `daily.temperature_2m_max[i]` ab Index `i ≥ 4` (= 8. Juni) sind **finite, plausible Werte** statt 0.
2. Browser: `/karten/region` und `/embed/region-lokal` zeigen Symbole/Temperaturen auch für Mo–Mi.
3. Spot-Check: wenn `ecmwf_ifs025` als einziges Modell für späte Tage Daten liefert, werden seine Werte gerendert.
