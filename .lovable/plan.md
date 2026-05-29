## Befund

Im Log:

```
[ch1] selected run 2026-05-29T18:00:00+00:00 with 6 tot_prec items
[ch1] run 2026-05-29T18:00:00Z present but only 2 steps — re-process
[ch1] run=2026-05-29T18:00:00Z horizons=0..2 (3 hours)
```

Der MeteoSchweiz 18Z-Lauf wurde gerade angefangen zu publizieren — nur ~3 Horizonte (0..2) sind verfügbar (6 STAC-Items = 3 Horizonte × {ctrl,pert}). `find_latest_run` greift trotzdem den neuesten Lauf, weil die einzige Bedingung ist: „mind. 1 ctrl + 1 pert für h1..3". Der vorherige 15Z-Lauf (vollständig 33 h / 120 h) wird ignoriert und in `cleanup_old_runs` sogar gelöscht.

Folge: Manifest enthält 2 Schritte mit 0.000 mm/h → Frontend sieht „eps no steps" und fällt auf Deterministisch zurück.

## Fix (1 Datei: `scripts/ingest_icon_eps.py`)

### 1. `find_latest_run` – Vollständigkeit bewerten, vollständigsten jüngsten Lauf wählen

Statt „neuester Lauf mit ≥1 h1..3"-Logik:

- Pro Kandidat-`ref_time` Anzahl **distinkter Horizonte mit ctrl+pert** zählen.
- Akzeptanzschwelle: `>= ceil(MAX_HORIZON[model] * 0.9)` Horizonte.
- Den **neuesten** Lauf wählen, der diese Schwelle erfüllt.
- Wenn keiner sie erfüllt, den Lauf mit den **meisten Horizonten** zurückgeben (besser als gar nichts) und Log-Warnung ausgeben.

Damit wird bei frisch publiziertem unvollständigem 18Z der 15Z-Lauf (vollständig) gewählt; sobald 18Z genügend Horizonte hat, springt der Ingest automatisch um.

### 2. `main` – Re-Process nur, wenn neue Items mehr Horizonte liefern

Block ab Zeile 980 erweitern:

- `prev_steps_n = len(prev.get("steps") or [])`
- Verfügbare Horizonte des aktuellen `items` zählen (analog 1.).
- Re-Process nur, wenn `available_horizons > prev_steps_n`. Sonst skip mit `[…] run X present (prev=N steps, available=M) — skip`.

Verhindert, dass ein vollständiger 33-Schritt-15Z-Manifest durch einen 2-Schritt-18Z-Reingest überschrieben wird, falls Punkt 1 doch mal denselben Lauf erneut liefert.

### 3. `cleanup_old_runs` Schutz

Sicherstellen, dass `keep_tags` immer auch den im Manifest stehenden vorherigen Run enthält (ist bereits implementiert, Zeile 994–1000). Keine Änderung nötig – nur verifizieren, dass nach Fix 1 der gewählte Lauf konsistent ist.

## Validierung nach Fix

- Nächster Ingest-Run protokolliert `[ch1] selected run 2026-05-29T15:00:00Z with 132 tot_prec items` (oder ähnlich mit ~66 Horizonten × 2).
- `[ch1] run=2026-05-29T15:00:00Z horizons=1..33 (33 hours)`.
- `radar/eps/latest.json` enthält wieder `ch1: ~24 steps`, `ch2: ~80 steps`.
- Frontend-Log: `[radar] forecast source: eps-mean (ch1=24, ch2=80, det=…)`.
- Beim nächsten Cron-Run (≥30 min später) sollte 18Z dann ≥30 Horizonte haben und automatisch übernommen werden.

## Nicht angefasst

- Frontend / `radar.functions.ts` / `icon-eps-cache.server.ts` (Phase-2-Pfad funktioniert; bereits letzter Turn gefixt).
- Render-/GRIB-/Resample-Pipeline (`process_model`, `_open_grib_messages`, etc.).
- GitHub-Workflow (Cron-Frequenz bleibt 30 min, schon korrekt).
- Andere Karten.

## Hinweis zu den 0.000-mm-Werten

Im aktuellen Log sind alle Member 0.0 mm/h — bei dem schmalen Oberthurgau-Bbox (8.15–10.55 E, 46.85–48.3 N) und ggf. trockener Wetterlage ist das **plausibel** und kein Bug. Nach Fix 1 wird der 15Z-Lauf gerendert, dessen Werte zeigen, ob aktuell wirklich kein Regen prognostiziert ist oder ob ein zweiter Bug in der Member-Aggregation lauert. Falls dann immer noch alles 0 ist, in einem Folge-Turn `process_model` debuggen.
