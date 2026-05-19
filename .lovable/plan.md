## Änderungen in `src/lib/weather.ts`

### Ziel
MeteoSchweiz `icon_seamless` bleibt führend (Tag 1–5/6). Fehlende Werte gegen Ende (Sonntag-Lücken, Montag) werden mit dem Open-Meteo `best_match`-Modell aufgefüllt.

### Vorgehen

1. **Zweite Anfrage**: in `fetchForecast` zusätzlich `best_match` parallel abrufen (`Promise.all`).
   - Identische Parameter (lat/lng, `forecast_days=7`, gleiche hourly/daily-Variablen).
   - `best_match` liefert für Amriswil zuverlässig 7 volle Tage.

2. **Merge-Funktion `fillGaps(primary, fallback)`** (ersetzt das alte `mergeForecasts`):
   - Iteriere über alle Felder in `hourly` und `daily`.
   - Für jedes Array-Index `i`: wenn `primary[i] == null` (oder `NaN`), nimm `fallback[i]`; sonst behalte `primary[i]`.
   - Greift sowohl für Wind-Variablen (die bei MeteoSchweiz komplett `null` sind — siehe Network-Response) als auch für die Trailing-Nulls am Montag.
   - Achtung: für `time`-Arrays nichts mergen (gleiche Reihenfolge garantiert).

3. **`sanitizeForecast`** behält den bisherigen Job (Sicherheits-Cleanup), wird aber nach dem Merge ausgeführt.

4. **Konstanten**: `TOTAL_DAYS = 7` bleibt. Kein neues Modell-Enum exportieren.

### Nicht enthalten
- Keine UI-Änderungen.
- Kein Wechsel von MeteoSchweiz als Hauptquelle.
- Kein ECMWF (war bewusst entfernt).

### Hinweis zur Footer-Zeile
- Quellenangabe bleibt „MeteoSchweiz ICON-CH1 / ICON-CH2"; ergänzt wird dezent „· Lücken: Open-Meteo best_match".
