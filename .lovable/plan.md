# Ziel

Wetterprognose näher an MeteoSchweiz bringen, indem wir für die hinteren Tage auf das ECMWF-IFS-Modell wechseln (so wie es MeteoSchweiz auch tut).

# Modell-Blending (zeitlich gestaffelt)

| Zeitraum | Modell | Begründung |
|---|---|---|
| Tag 0 – 3 (heute + 3 Folgetage) | `meteoswiss_icon_seamless` (ICON-CH1 → ICON-CH2) | hochauflösendes Schweizer Modell, stark in der Kurzfrist |
| Tag 4 – 5 | `ecmwf_ifs025` | global, beste mittlere Frist, MeteoSchweiz nutzt ab da auch IFS |

Kein gleitendes Mischen der Wertewerte — sondern harter Wechsel auf Tagesgrenze. Grund: `weathercode` ist kategorisch (1, 61, 95 …), Mitteln ergibt Unsinn. Bei numerischen Werten (Temp, Wind) wäre Mitteln möglich, aber inkonsistent zum Symbol; daher einheitlich pro Tag *ein* Modell.

# Umsetzung in `src/lib/weather.ts`

1. **`fetchForecast`** ruft Open-Meteo **zweimal parallel** auf (`Promise.all`):
   - Call A: `models=meteoswiss_icon_seamless`, `forecast_days=4`
   - Call B: `models=ecmwf_ifs025`, `forecast_days=6` (wir brauchen nur Tag 4 + 5, aber API erlaubt kein "start_day")
   - Beide mit denselben `daily` und `hourly` Variablen, gleicher `timezone=auto`.
2. **`mergeForecasts(iconRes, ecmwfRes)`** baut die finale `ForecastResponse`:
   - **Daily**: Index 0–3 aus ICON, Index 4–5 aus ECMWF (per `date` matchen, nicht per Position, damit Zeitzonen-Edge-Cases sicher sind).
   - **Hourly**: Slots gruppieren nach `iso.slice(0,10)`; pro Datum komplett ICON ODER ECMWF, abhängig davon, welches Modell für diesen Tag aktiv ist.
   - `current_weather` und Meta (`latitude`, `longitude`, `timezone`, `utc_offset_seconds`) aus ICON übernehmen.
3. **`sanitizeForecast`** bleibt unverändert und läuft auf dem zusammengesetzten Objekt.
4. Falls **ein Call fehlschlägt**, fallback auf den erfolgreichen (mit gekürztem Horizont) statt komplettem Fehler.

# UI-Änderung

- Im DetailPanel-Header oder als kleiner Hinweis im Footer: dezentes `Modell: MeteoSchweiz ICON (Tag 1–4) · ECMWF IFS (Tag 5–6)`, damit die Quelle transparent ist. Optional — sag Bescheid, ob du das willst, sonst lasse ich die UI komplett unverändert.

# Was *nicht* gemacht wird

- Kein MOS / Post-Processing wie MeteoSchweiz (das ist proprietär).
- Kein Ensemble-Handling (`*_eps`) — Open-Meteo liefert deterministische Felder, das reicht für Symbole.
- Symbol-Mapping (`WeatherIcon` → WMO-Code) bleibt wie es ist.

Erwartetes Ergebnis: Tag 4–5 weichen nicht mehr so stark von der MeteoSchweiz-Wochenübersicht ab.