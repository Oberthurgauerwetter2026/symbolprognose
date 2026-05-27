# Radar-Messung farblich an Prognose angleichen

## Problem

Im Radar-Layer auf `/karten/radar` werden gemessene Niederschläge anders eingefärbt als die Prognose / Nowcast-Frames:

- **Messung** (PNG, gerendert in `scripts/ingest_radar.py` via `PRECIP_SCALE`): 15 Stufen, helle Blautöne, viel Gelb/Orange, eingebackenes Alpha 140–250.
- **Prognose / Nowcast-Canvas** (`PrecipOverlay` in `src/components/maps/radar-map.tsx` via `SCALE` / `colorFor`): 9 Stufen, andere Schwellwerte, Alpha 0.35 (lowest) bzw. 0.60.

Resultat: gleiche mm/h-Werte sehen verschieden aus, und beim Übergang vom letzten Mess-Frame zum ersten Nowcast/ICON-Frame springt die Farbe sichtbar.

## Änderungen

### 1. `scripts/ingest_radar.py` — `PRECIP_SCALE` ersetzen

Skala 1:1 auf die JS-Prognosepalette ausrichten (Schwellen + RGB exakt wie `SCALE`, Alpha gemäss `colorFor`: 89 für niedrigste Stufe, 153 darüber):

```python
PRECIP_SCALE = [
    (0.2,  (167, 174, 211,  89)),
    (1.0,  ( 30,  60, 230, 153)),
    (2.0,  ( 30, 120,  50, 153)),
    (4.0,  ( 70, 200,  70, 153)),
    (6.0,  (240, 235,  50, 153)),
    (10.0, (240, 200, 120, 153)),
    (20.0, (240, 140,  30, 153)),
    (40.0, (225,  30,  30, 153)),
    (60.0, (150,  30, 200, 153)),
]
```

`< 0.2 mm/h` bleibt transparent.

### 2. `src/components/maps/radar-map.tsx` — `ImageOverlay opacity` für Messung

`opacity={0.95}` auf dem Radar-PNG (≈ Z. 800) auf `1.0` setzen, damit das jetzt im PNG eingebrannte Alpha nicht doppelt multipliziert wird. Hagel-Overlay und `PrecipOverlay` (Forecast-Canvas) bleiben unverändert.

### 3. Legende prüfen

Falls eine separate Legende auf der Karte eine eigene Skala enthält, an die neue (= bestehende `SCALE`) angleichen. Wird die Legende bereits aus `SCALE` gespeist, ist sie automatisch konsistent.

## Nicht im Scope

- `HAIL_SCALE` (Hagel) unverändert.
- `SNOW_SCALE` (Schnee) unverändert.
- Geometrie / Bounds / Nowcast-Motion-Logik unverändert.

## Wirksamkeit

Wirkt erst, nachdem der Ingest-Job mindestens einmal neu gelaufen ist. Bereits in R2 liegende PNGs sind mit der alten Palette eingebrannt und werden vom Ingest nicht überschrieben. Optionen: warten, bis nur noch neu generierte Frames im 24h-Retentionsfenster liegen, oder die Precip-PNGs im R2 einmalig löschen, damit sie neu erzeugt werden.

## Verifikation

- Identische mm/h-Werte (z. B. 4 mm/h-Pixel) zeigen in Messung und Prognose den gleichen Grünton.
- Übergang im Zeitstrahl vom letzten Mess-Frame zum ersten Nowcast-/ICON-Frame ohne Farb-Sprung.
