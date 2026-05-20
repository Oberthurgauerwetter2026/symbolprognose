## Ziel

Prognose-Zusammensetzung in `src/lib/weather.ts`:

- **Stunden 0–23 (heute, ab Lokalzeit-Startpunkt der CH1-Reihe)**: ICON-CH1-EPS
- **Stunde 24 bis Ende CH2-Reichweite (≈ Tag 5)**: ICON-CH2-EPS
- **Danach bis Tag 7**: ECMWF IFS 0.25° Ensemble
- best_match weiterhin nur als Restfallback für Felder, die Ensembles nicht liefern (Probability, Sunrise/Sunset).

## Zusätzliches Problem

Die aktuell verwendeten Modell-IDs `icon_ch1_eps` / `icon_ch2_eps` werden von der Open-Meteo Ensemble-API **abgewiesen** (HTTP 400 – siehe Netzwerk-Log). Korrekt laut Doku/API-Test sind:

- `meteoswiss_icon_ch1`
- `meteoswiss_icon_ch2`

Ohne diese Korrektur liefert CH1/CH2 dauerhaft `null` und es greift nur IFS/best_match — die gewünschte Schichtung ist gar nicht aktiv.

## Änderungen (nur `src/lib/weather.ts`)

1. **Modellnamen korrigieren** in `EnsembleModel`, `ENSEMBLE_DAYS` und beiden `fetchEnsembleMean`-Aufrufen:
   - `icon_ch1_eps` → `meteoswiss_icon_ch1`
   - `icon_ch2_eps` → `meteoswiss_icon_ch2`
   - `ecmwf_ifs025` bleibt

2. **CH1 auf 0–24 h begrenzen**: Neue Helferfunktion `sliceEnsembleHourly(ens, maxHours)` schneidet `time` und alle Variablen-Arrays auf die ersten N Stunden. Vor dem `wrapEnsembleAsForecast(ch1Raw)` mit `maxHours = 24` anwenden.

3. **Merge-Reihenfolge präzisieren** (in `fetchForecast`):
   - `primary = CH1[0..24h]` (sonst CH2 → IFS → best_match wie bisher)
   - `fillGaps` mit CH2 (füllt ab Stunde 24)
   - `fillGaps` mit IFS (füllt ab Ende CH2)
   - `fillGaps` mit best_match (Probability/Sunrise/Sunset/Reste)
   - Den fehlerhaften Vergleich `primary !== (ch2Raw && wrapEnsembleAsForecast(ch2Raw))` (erzeugt jedes Mal ein neues Objekt → Vergleich nie true) durch ein Flag `primarySource` ersetzen, damit CH2 nicht doppelt eingemischt wird, wenn CH1 fehlte und CH2 schon primary ist.

4. Kommentar/Erklärung im Code anpassen (Tag 1 = 0–24h aus CH1, dann CH2, dann IFS).

## Tech-Details

- `sliceEnsembleHourly` iteriert über die Keys von `ens` und ruft `.slice(0, maxHours)` auf jedem Array auf; `time` ebenso.
- Daily-Re-Aggregation am Ende von `fetchForecast` bleibt unverändert — sie arbeitet auf dem gemergten Stunden-Array und ergibt automatisch korrekte Tageswerte aus der neuen Schichtung.
- Keine UI-Änderungen.
