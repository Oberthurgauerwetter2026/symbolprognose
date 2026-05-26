
## Ziel

Zwischen zwei stündlichen ICON-CH1-Niederschlagsfeldern echte **Bewegung** (statt Crossfade) für die drei 15-min-Zwischenslots erzeugen. Verschiebungsrichtung kommt aus dem mittleren 700-hPa-Windvektor der jeweiligen Stunde (steuert Niederschlag in mittleren Breiten gut).

Verhalten beim Sliden:
```text
H:00  ████░░░░  (Originalfeld H)
H:15  ░████░░░  (Feld H um ¼ Stunde mit Wind verschoben)
H:30  ░░████░░  (Feld H um ½ Stunde verschoben, mit B beginnend einzublenden)
H:45  ░░░████░  (¾, fast vollständig B rückwärts verschoben)
H+1:00 ░░░░████ (Originalfeld H+1)
```

## Änderungen

### 1. `scripts/ingest_openmeteo.py` (phase1 erweitern)

`p1`-Request um stündliche Windkomponenten ergänzen — Open-Meteo erlaubt `minutely_15` + `hourly` im selben Call:

```python
p1 = {
    "minutely_15": "precipitation,snowfall",
    "past_minutely_15": 48,
    "forecast_minutely_15": 132,
    "hourly": "wind_speed_700hPa,wind_direction_700hPa",
    "past_hours": 12,
    "forecast_hours": 36,
    "timezone": "UTC",
    "models": "meteoswiss_icon_ch1",
}
```

Wind-Werte werden pro Grid-Punkt zurückgegeben und genauso wie `minutely_15` in `phase1` der Cache-JSON gespeichert (kein neues Top-Level-Feld nötig; LocResponse hat schon `hourly`-Block).

### 2. `src/lib/radar.functions.ts`

**A.** `LocResponse.hourly` um `wind_speed_700hPa` und `wind_direction_700hPa` erweitern (Typ).

**B.** Nach dem Bauen der Forecast-Frames pro Stundenanker einen **mittleren Windvektor** über alle Grid-Punkte ableiten:

```text
u = -speed * sin(dir_rad)   (Komponente in Lon-Richtung, m/s)
v = -speed * cos(dir_rad)   (Komponente in Lat-Richtung, m/s)
```

Dann pro Stunde Anker H Versatz in **Grid-Zellen pro 15 min** umrechnen:
- 1 Grad Lat ≈ 111 km; 1 Grad Lon ≈ 111 km · cos(mittlere Lat)
- Zellgröße: `dLat = (maxLat-minLat)/(GRID_LAT-1)`, `dLon = analog`
- Verschiebung Δi (Zeilen) = `v · 900 s / (dLat · 111000)`
- Verschiebung Δj (Spalten) = `u · 900 s / (dLon · 111000 · cos(lat))`

**C.** Aktuelle lineare Wert-Interpolation (Zeilen 200–234) ersetzen durch **semi-Lagrange-Advection** zwischen Anker A (Stunde H) und B (Stunde H+1):

```text
für jeden 15-min-Slot k ∈ {1,2,3} zwischen A und B:
  t = k / 4
  A_shifted = shift(A, +k · ΔAB)      // A vorwärts mit Wind H
  B_shifted = shift(B, -(4-k) · ΔAB)  // B rückwärts mit Wind H+1
  frame_k.values = (1-t) · A_shifted + t · B_shifted
```

`shift(field, di, dj)` bilinear über das row-major-Grid (Padding mit 0 am Rand). Klein und schnell — Grid ist 20×12 = 240 Punkte, pro Frame O(240).

**D.** Snowfall analog (gleicher Windvektor).

**E.** Frames vor dem ersten Anker (z. B. `:15` `:30` `:45` direkt nach „now") bekommen `A_shifted` mit `B = A` als Fallback, damit auch dort Bewegung sichtbar ist.

## Was unverändert bleibt

- Radar-Past (R2-PNGs) — keine Advection nötig, echte 5-min-Messungen.
- Hagel-Layer, BBox, Slider-UI, Cross-Fade, Farben, Filter, Edge-Fade.
- Frontend (`radar-map.tsx`, `PrecipOverlay`) — bekommt nur „bessere" Werte in denselben Frames.
- ICON-CH2, phaseA/C, alle Symbolprognose-Daten.

## Hinweise

- 700 hPa ist ein guter Kompromiss für Schichtbewölkung/Niederschlag. Für Schauer/Gewitter wäre Optical Flow nötig (Option A) — bewusst hier nicht.
- Wenn Open-Meteo `wind_*_700hPa` für ICON-CH1 nicht liefert (manche Modelle nur 10m), Fallback auf `wind_speed_10m`/`wind_direction_10m` × 2.5 als grobe Schätzung des Steuerwinds. Wird beim ersten Ingest-Run sichtbar; ich passe dann an.
- GitHub Action muss nach dem Skript-Update einmal manuell getriggert werden, damit der R2-Cache die Windfelder enthält.
