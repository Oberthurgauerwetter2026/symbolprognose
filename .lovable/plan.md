# Radar-Abdeckung erweitern auf Bodensee-Region (CH + S-D + Vorarlberg)

Aktuell deckt der Prognose-Grid nur Oberthurgau ab (BBOX 47.30–47.85 / 8.85–9.85, 20×12 = 240 Punkte). Die Messung kommt zwar schon mit der grösseren CombiPrecip-BBOX 46.85–48.30 / 8.15–10.55, ist aber durch den engen Map-Initial-Zoom (center 47.575/9.35, zoom 9.75) nicht sichtbar.

Ziel: Beide Layer decken die ganze CombiPrecip-Region ab — Schaffhausen, Zürich, St. Gallen, Appenzell, Vorarlberg, Bodensee + Süddeutschland — und der Standard-Map-View zeigt sie auch.

## 1. Prognose-Grid erweitern

**`scripts/ingest_openmeteo.py`** (Defaults `build_grid()`):
- `BBOX_MIN_LAT 47.30 → 46.85`, `BBOX_MAX_LAT 47.85 → 48.30`
- `BBOX_MIN_LON 8.85 → 8.15`, `BBOX_MAX_LON 9.85 → 10.55`
- `GRID_LAT 12 → 22`, `GRID_LON 20 → 36` (≈ 0.067° Spacing, 792 Punkte statt 240)

**`.github/workflows/openmeteo-ingest.yml`**: gleiche Env-Werte setzen, damit der nächste Cron-Run die neue Geometrie schreibt.

**`src/lib/radar.functions.ts`**: `BBOX`, `GRID_LAT`, `GRID_LON` identisch aktualisieren — Lese-Grid muss exakt mit Ingest-Grid übereinstimmen, weil Werte über Index abgegriffen werden.

## 2. Map-Initial-View zoomen out

**`src/components/maps/radar-map.tsx`** (Zeile ~825):
- `center=[47.575, 9.35]` → `center=[47.575, 9.35]` bleibt (gute Mitte für Bodensee)
- `zoom=9.75` → `zoom=8.5` (zeigt von Zürich/Schaffhausen bis Vorarlberg, Bodensee komplett)
- `maxBounds` bleibt unverändert (46.80–48.35 / 8.10–10.60 — schon korrekt dimensioniert).

## 3. Lifecycle / Übergang

- Bis der nächste Ingest läuft, hat der R2-Cache (`openmeteo/forecast.json`) noch das alte 240-Punkte-Grid. Die Frontend-`BBOX`/`GRID_*`-Konstanten würden dann falsche Indizes lesen.
- Lösung: Frontend liest, falls vorhanden, `grid.points` aus dem Cache-Payload und leitet `BBOX`/`GRID_LAT`/`GRID_LON` daraus ab (Min/Max + Unique-Counts). Bestehende `BBOX`/`GRID_*`-Konstanten bleiben nur als Fallback für leeren Cache.
- Damit kein Render-Bruch nach Deploy + vor erstem neuen Cron-Lauf.

## 4. Nicht Teil dieser Änderung

- Messung (CombiPrecip-PNG-Overlay) bleibt — bereits korrekte BBOX, nur jetzt sichtbar dank Zoom-out.
- Radar-Ingest (`scripts/ingest_radar.py`) bleibt unverändert.
- Farben/Alpha/Filter/Clip-Logik aus den letzten Runden bleiben.
- 48-h-Prognosehorizont bleibt.

## Technische Details

- Mehr Grid-Punkte = ~3,3× Open-Meteo-API-Last pro Ingest. Bei einem 5-min-Cron weiterhin im freien Kontingent.
- Auto-Detection aus `grid.points`: O(n) Min/Max + Set für unique lats/lons. Validierung: Wenn Punktzahl ≠ nLat × nLon, Fallback auf Konstanten.
- Keine DB-, Auth- oder Server-Fn-Signaturänderungen.
