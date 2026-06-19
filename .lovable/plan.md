## Diagnose

Im Aggregations-Pfad `buildForecastFromMchLoc` (`src/lib/forecast-aggregated.functions.ts`) gibt es eine stille Datenverlust-Kette:

1. **MCH-STAC liefert oft kein stündliches `rre150h0`** (Niederschlag-mm). Die Ingest-Skripte machen dann `precipitation: [null, null, …]`.
2. Beim Aufbau der Aggregate wird das Array via `h.precipitation.map((v) => num(v))` in **lauter `0.0`** umgewandelt (`num(null, 0) → 0`).
3. `aggregateDailyFromHourly` rechnet daraus `precipitation_sum = 0` (statt `null`, da `0` `Number.isFinite` besteht).
4. `enrichDailyFromHourly` **überschreibt** den korrekten MCH-Tageswert aus `rka150p0` (z. B. 5 mm) mit der 0.
5. Ergebnis: `hourly.precipitation` ist überall 0 → `DayRainSparkline` zeichnet nichts. Auch die Tages-mm-Zahl wird auf 0 gedrückt.

MCH zeigt für Amriswil mehrere mm/Stunde — wir zeigen 0, obwohl die Quelle dieselbe ist.

## Fix (zwei kleine Änderungen in `src/lib/forecast-aggregated.functions.ts`)

### 1) Nullen statt 0 für fehlende MCH-Stundenwerte

In `buildForecastFromMchLoc` die Mapper für `precipitation` (und analog `snowfall`) so ändern, dass `null` erhalten bleibt:

```ts
precipitation: h.precipitation.map((v) => (v == null ? null : num(v))),
snowfall:      h.snowfall.map((v) => (v == null ? null : num(v))),
```

Damit fließt `null` ungehindert in `aggregateDailyFromHourly`; `finite()` filtert sie raus; `sum([])` liefert `null`; `enrichDailyFromHourly` lässt das MCH-`rka150p0` stehen → die mm-Zahl in der Kachel ist wieder korrekt.

### 2) Stunden-Niederschlag aus Open-Meteo nachziehen, wenn MCH keine Stundenwerte hat

Damit die Sparkline-Säulen tatsächlich Regen zeigen (MCH liefert oft nur Tagessumme), in der phaseA→Open-Meteo-Überlagerung pro Stunde:

- Wenn `merged.hourly.precipitation[i] == null` (kein MCH-Wert), den Open-Meteo-Wert übernehmen.
- Analog für `precipitation_probability` (MCH hat keine Wahrscheinlichkeit; bereits heute aus OM).

Das passt in den bestehenden Overlay-Loop ab `forecast-aggregated.functions.ts:617`; nur das Befüll-Kriterium ändert sich von „leer/NaN" auf „null oder NaN".

### 3) Re-aggregieren erst nach der OM-Überlagerung

Sicherstellen, dass `enrichDailyFromHourly` **nach** dem Overlay läuft (bereits der Fall), damit die Tages-mm aus den jetzt befüllten Stundenwerten wieder konsistent sind — und beim Fallback aus OM die Säulen plus Tagessumme matchen.

## Nicht geändert

- `DayRainSparkline` selbst bleibt unverändert (vertikale 8 × 3h-Säulen).
- Keine Änderung am MCH-Ingest-Skript oder an der STAC-Required-Liste.
- `FORECAST_VERSION` auf `v11` bumpen, damit Browser-Cache verworfen wird.

## Prüfung

`/karten/lokal?lat=47.5428&lon=9.2871&name=Amriswil` – Amriswil-Kacheln zeigen wieder Regen-Säulen und plausible mm-Werte, vergleichbar mit der MeteoSchweiz-Lokalprognose-Seite (#forecast-tab=detail-view).
