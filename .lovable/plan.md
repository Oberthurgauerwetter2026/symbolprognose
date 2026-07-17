# Warum die Sprenkel noch sichtbar sind & Fix

## Diagnose

Der Morphologie-Filter ist im Code aktiv (`scripts/_morph.py` + Aufrufe in `ingest_radar.py` / `ingest_openmeteo.py`). Zwei Gründe, warum das Screenshot trotzdem Sprenkel zeigt:

1. **Parameter für Prognose zu schwach.** Der Fix wurde mit `min_area_px=2, hole_area_px=2` geschrieben, unter der Annahme eines groben ICON-Grids (22 × 36). Tatsächlich rendert `ingest_openmeteo.py` die Prognose-PNGs aber auf dem **Dense-Grid 48 × 56** (`GRID_LAT_DENSE`/`GRID_LON_DENSE` im Workflow). Auf diesem viel feineren Grid überleben Sprenkel mit 2–5 Pixel Fläche problemlos — genau das ist auf dem Screenshot zu sehen (Prognose Do, 21:45).
2. **Ingest muss durchgelaufen sein.** PNGs im R2 werden erst beim nächsten `openmeteo-ingest.yml`-Lauf ersetzt (Cron alle 5 min).

## Fix

Nur die Parameter für die Prognose anheben, damit sie zum Dense-Grid passen — sonst nichts ändern.

- `scripts/ingest_openmeteo.py`: `clean_precip_field(arr, PRECIP_SCALE, min_area_px=6, hole_area_px=6)` (statt 2/2). Bei 48×56 entspricht 6 px ≈ 0.4 % der Bildfläche — sicher unterhalb realer Zellen, aber deutlich über typischen Sprenkel-Clustern.
- `scripts/ingest_radar.py`: bleibt bei `4/4` (Ausgabegrid ~500×300, funktioniert bereits).
- Anschliessend `openmeteo-ingest.yml` manuell triggern, damit der R2-Cache sofort mit bereinigten PNGs neu befüllt wird.

Keine Änderungen an Frontend, Farbskala, Konturen, Auflösung oder Manifesten.

## Verifikation

1. Nach dem Ingest ein Prognose-Frame im Radar-Layer prüfen: keine isolierten Pixel/Sprenkel mehr, Konturen unverändert.
2. Ein Messungs-Frame prüfen: unverändert sauber (keine Regression).
