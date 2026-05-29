# Fix: ICON-EPS Ingest parst keine Items

## Problem

Letzter Workflow-Lauf:
```
[ch1] STAC tot_prec items in window: features=14385 parsed=0
[ch1] no run found
```

Ursache: `forecast:horizon` aus MCH-OGD-STAC kommt als volle ISO-8601-Duration
`"P0DT10H00M00S"`. Unsere Regex `^P(?:T)?(\d+)H` erwartet `"PT10H"` und matcht
nicht → `_item_to_stac` gibt für jedes Feature `None` zurück.

## Änderungen

**Nur** `scripts/ingest_icon_eps.py`, Funktion `_item_to_stac`:

- Horizon-Parsing ersetzen durch vollständige ISO-8601-Duration-Regex:
  `^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$`, dann
  `h_int = days*24 + hours` (Minuten/Sekunden ignorieren, EPS ist stündlich).
- Int/Float-Fallback bleibt.

Zusätzlich in `find_latest_run`:

- Wenn `features > 0` aber `parsed == 0`, das erste Feature als JSON-Snippet
  loggen — damit ein künftiger Schema-Drift sofort sichtbar ist.
- STAC-Fenster von 36h auf 12h verkürzen (ein EPS-Lauf alle 3h reicht; macht
  Pagination deutlich kürzer, ca. 14k → ~5k Features pro Modell).

**Nicht angefasst:** GRIB-Decode, Resample, Render, R2-Upload, Manifest,
Workflow-YAML, Frontend.

## Verifikation

1. Workflow "ICON-EPS Ingest" manuell triggern.
2. Erwartet im Log: `parsed=M` mit `M > 0`, dann `selected run …`,
   anschließend GRIB-Downloads und am Ende `wrote latest.json`.
3. Check: `https://<R2_PUBLIC_URL>/radar/eps/latest.json` liefert JSON
   mit `models.ch1.steps[]`.

## Hinweis zur Laufzeit

Erster erfolgreicher Lauf wird länger dauern (ca. 700 GRIB-Dateien für CH1
bei H=33, ~2500 für CH2 bei H=120). Falls das Workflow-Timeout (30 min)
nicht reicht, im Folgeschritt `EPS_MAX_HORIZON_CH2` reduzieren — das ist
aber ein separater Fix, nicht Teil dieses Plans.
