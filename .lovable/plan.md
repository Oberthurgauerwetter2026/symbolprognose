## Ziel

Statt einem einzelnen globalen Bewegungsvektor pro Frame ein **Bewegungsfeld** aus der Kreuzkorrelation der letzten Radarbilder berechnen, mit dem 700-hPa-Wind als physikalischem Prior gewichten, und nur fallen lassen wenn weder Radar noch Wind brauchbar sind. Damit verschwindet die Wind-Fallback-Vorzeichen-Falle als Hauptursache, und die Zugbahn richtet sich nach dem, was *im Bild* passiert.

## Was sich ändert

### 1. `scripts/ingest_radar.py` — tiled phase correlation + Wind-Prior

Statt `_phase_correlation(a, b)` über das ganze 1024×768-Bild:

- Bild in **8×6 Kacheln à 128 px** mit 50 % Überlappung schneiden (Hanning-Fenster pro Kachel).
- Pro Kachel `_phase_correlation` rechnen → `(dx_px, dy_px, conf, wet_frac)`.
- Kacheln verwerfen, wenn `wet_frac < 0.05` (kein Niederschlag drin) oder `conf < 0.15`.
- 3×3-Median-Filter über das Kachelfeld (räumliche Glättung gegen Ausreisser).
- 700-hPa-Wind (aus Open-Meteo, **im Ingest** mitgeladen für Bbox-Mitte) als **Bayes-Prior** mit Gewicht `1 − conf` in jede Kachel mischen. Dadurch driften datenarme Ecken Richtung Wind, datenreiche Zentren bleiben beim Radarbild.
- Persistieren als `motion.field: { rows, cols, u_deg_per_min[], v_deg_per_min[], conf[] }` im Manifest, **plus** weiterhin globaler Median `u_ms/v_ms/u_deg_per_min/v_deg_per_min` als Rückfall fürs Frontend.
- `RADAR_INGEST_VERSION` auf `v9-optical-flow`.

### 2. Wachstum/Zerfall pro Kachel

Aktuell ist `growth_per_min` ein einziger Skalar fürs ganze Bild. Erweitern auf `motion.growth_field` (gleiches Grid) per linearer Regression der mittleren Intensität pro Kachel über die letzten 6 Frames. Clampen auf ±5 %/min.

### 3. `src/lib/radar.functions.ts` — Feld lesen, Median verwenden, Wind-Fallback fixen

- Wenn `manifest.motion.field` existiert: für jedes Nowcast-Frame den **gewichteten Median** der Kachel-Vektoren über den aktuellen Bbox-Ausschnitt berechnen (nicht den naiven Median über alle Kacheln — Kacheln ohne Niederschlag werden bereits im Ingest verworfen, deshalb ist das Feld bereits gefiltert). `nowcastMotion.source = "radar-field"`.
- Wenn das Feld <4 valide Kacheln hat: zurück zum globalen `u_deg_per_min/v_deg_per_min`. `source = "radar"`.
- Erst dann der Wind-Fallback (`source = "wind"`). Die Vorzeichen in Z. 488–489 sind mathematisch korrekt (NW-Wind 315° → `uMs = +5.8`, `vMs = −5.8` → bearing 135° = SE). Aktuell liefert das Browser-Bild trotzdem NW-Drift — also als Sicherung **einen Unit-Test in `assertWindMotionSign()` erweitern**, der zusätzlich die *Bbox-Shift-Konsequenz* prüft (`dLon > 0 → Ostverschiebung`), und einen sichtbaren `[radar/nowcast/wind]`-Log um `expected: cells move SE for NW-wind` ergänzen. Damit lässt sich beim nächsten Auftreten in einer Logzeile sofort sehen, welche Stufe (Open-Meteo-Daten vs. Trig vs. Bbox-Anwendung) lügt.
- Wachstumsfaktor: wenn `growth_field` vorhanden, Median über genutzte Kacheln; sonst skalarer Wert wie bisher.

### 4. `src/components/maps/radar-map.tsx` — Pfeil-Overlay erweitern

- Pfeil zeigt weiterhin die **angewandte** Zugbahn (`imageOffset`).
- Label um `source` ergänzen: `"Zugbahn 135° SE · radar-field (7 Kacheln)"` vs. `"… · wind-fallback"`. Damit ist beim nächsten Wahrnehmungs-vs-Code-Konflikt sofort klar, welcher Pfad aktiv ist.
- Wenn `motion.field` und Debug-Query `?debugFlow=1`: kleine Pfeile pro Kachel als SVG-Overlay (nur Debug, kein Default).

### 5. Was *nicht* angefasst wird

- Bbox, Auflösung, R2-Upload-Logik, Palette.
- ICON-CH1-Übergang ab T+60, Snow-Overlay, Pollen, Wind-Karten.
- Bestehende `assertWindMotionSign()`-Erwartungen (nur erweitert, nicht umgedreht).

## Technische Details

**Tile-Layout:** 8 Spalten × 6 Reihen, Kacheln 128 px (50 % Stride 64 px) → 16×12 Anker-Punkte, jede Kachel auf 128 px gefenstert. Pro Frame-Paar ~192 FFTs à 128² = günstig in numpy. Laufzeit-Schätzung: +~400 ms pro Ingest-Lauf (alle 5 min via GitHub Actions, unkritisch).

**Wind-Prior-Gewichtung:** `u_final = conf·u_radar + (1−conf)·u_wind` pro Kachel, mit `u_wind` aus Bbox-Mittel-Punkt (eine Open-Meteo-Abfrage pro Ingest, 5-min-Cache via R2). Verhindert NaN-Drift in regenfreien Ecken und macht den globalen Median robuster.

**Manifest-Erweiterung** (rückwärtskompatibel):
```text
motion: {
  u_ms, v_ms, u_deg_per_min, v_deg_per_min,    // wie bisher (Median)
  confidence, growth_per_min, ...,
  field: {                                      // NEU
    rows: 12, cols: 16,
    u_deg_per_min: [192 floats],
    v_deg_per_min: [192 floats],
    conf:          [192 floats],
    growth_per_min:[192 floats]
  }
}
```

Frontend liest `field` defensiv (`if (motion.field && motion.field.u_deg_per_min?.length === rows*cols)`), sonst alter Pfad.

**Edge-Runtime-Verträglichkeit:** Keine neuen Server-Abhängigkeiten im Worker — nur Array-Median über bereits geladenes JSON. Python-Seite bekommt nur `numpy` (schon da), kein OpenCV.

## Reihenfolge der Umsetzung

1. `scripts/ingest_radar.py`: `compute_motion_field()` neu, alter `compute_motion()` ruft sie und aggregiert → globaler Median bleibt erhalten.
2. `src/lib/radar.functions.ts`: Feld-Reader + Median-über-aktive-Kacheln, Log-Erweiterung, `assertWindMotionSign()` ergänzen.
3. `src/components/maps/radar-map.tsx`: Label-Erweiterung, optional Debug-Overlay.
4. `RADAR_INGEST_VERSION` bump → manueller Workflow-Trigger zum Erstellen des ersten `field`-Manifests.
5. Verifikation: Pfeil-Overlay + Console-Log auf `/karten/radar` checken, dass `source = radar-field` kommt und Pfeil mit Zellbewegung übereinstimmt.

## Was das löst und was nicht

**Gelöst:** Bei ausreichendem Radarsignal (Normalfall) ist die Zugbahn datengetrieben, nicht modellgetrieben — exakt das Verfahren, das du beschrieben hast (Cross-Correlation pro Bereich + Wind als Bias + Wachstums-Trend).

**Nicht gelöst:** In Stillstands-/Trockenphasen bleibt der Wind-Fallback. Mit dem zusätzlichen Log + `assertWindMotionSign()`-Erweiterung wird ein Re-Auftreten des Vorzeichen-Bugs aber sofort sichtbar statt monatelang unbemerkt.
