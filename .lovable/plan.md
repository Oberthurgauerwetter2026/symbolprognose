## Ziel

Wie bei MeteoSchweiz (INCA) oder DWD (RadVOR): Die letzten echten Radar-Messungen werden genutzt, um die **Verlagerung der Niederschlagszellen** für die nächsten ~60–90 min vorherzusagen — statt direkt nach `now` auf das gröbere ICON-CH1-Modellfeld umzuschalten. Danach wird sanft in ICON-CH1 übergeblendet.

## Heutiger Zustand (kurz)

- Vergangenheit (≤ now): echte MCH-CPC-PNGs aus R2 (`scripts/ingest_radar.py`).
- Zukunft (> now): direkt ICON-CH1 minutely_15, zwischen Stunden-Ankern via 700-hPa-Wind advektiert.
- Lücke: T+0…T+60 min nutzt **nicht** die tatsächlich gemessene Zellbewegung der letzten Radar-Frames → Prognose "springt" beim Übergang sichtbar und ist in der ersten Stunde ungenauer als nötig.

## Lösungsansatz

Zweistufiges Nowcasting analog INCA:

1. **Motion-Field aus Radar** (im Python-Ingest, der ohnehin numpy/PIL hat):
   - Aus den letzten 3 CPC-Arrays per **Phase-Correlation (FFT-Cross-Correlation)** einen mittleren Bewegungsvektor `(u_px_per_min, v_px_per_min)` der gesamten Szene berechnen — robust, schnell, deterministisch, keine ML-Abhängigkeit.
   - Vektor zusätzlich in m/s sowie als Lat/Lon-Drift pro Minute in `radar/frames.json` schreiben:
     ```
     motion: { u_ms, v_ms, u_deg_per_min, v_deg_per_min, sourceTs, confidence }
     ```
   - `confidence` = normierter Korrelations-Peak (0…1). Bei `confidence < 0.3` (z. B. flächiger gleichmässiger Regen oder leere Szene) wird der Vektor verworfen.

2. **Nowcast-Frames im Server-FN** (`src/lib/radar.functions.ts`):
   - Wenn `manifest.motion` mit ausreichender Confidence vorhanden ist, erzeuge zwischen `lastRadarT` und `lastRadarT + 60 min` **6 Nowcast-Frames im 10-min-Raster** als neuen `source: "nowcast"`:
     - `precipUrl` = letzte gemessene Radar-PNG-URL (wiederverwendet)
     - `imageOffset = { dLat, dLon }` = `motion.{v,u}_deg_per_min × Δt_min`
   - In diesem Fenster werden **vorhandene ICON-CH1-Frames unterdrückt** (oder linear gewichtet 1→0 von T+0 bis T+60 min, ICON 0→1 ab T+30 bis T+90 min, harter Übergang ab T+90).
   - Fallback: kein Motion-Vektor → heutiges Verhalten (ICON-CH1 sofort).

3. **Rendering** (`src/components/maps/radar-map.tsx`):
   - Erweitere `RadarFrame` um optionales `imageOffset?: { dLat, dLon }`.
   - Beim `ImageOverlay`-Render für Nowcast-Frames: `imageBbox` um `dLat/dLon` verschoben übergeben — Leaflet zeichnet das identische PNG einfach an einer verschobenen Position. Kein Pixel-Resampling im Browser nötig.
   - Cross-Fade-Loop bleibt unverändert; die Verlagerung sieht in der Animation aus wie echtes "Wandern" der Zellen.
   - Timeline-Label `Messung`/`Prognose` ergänzen um `Nowcast` (für `source === "nowcast"`).

## Warum so

- **Phase-Correlation** ist das Standardverfahren in operationellem Nowcasting (Rainymotion / pysteps `LucasKanade`-Alternative) und in Worker-tauglicher Python-Komplexität in <50 Zeilen mit `numpy.fft` umsetzbar.
- Das **PNG-Shift im Browser** vermeidet sowohl serverseitiges Re-Rendern als auch Canvas-Arbeit im Worker — und nutzt das tatsächliche MCH-Pixelbild (inkl. korrektem Farbschema) statt einer Modell-Interpolation.
- Modulares Confidence-Gate verhindert, dass bei stationärem oder leerem Niederschlag völlig falsche Drift-Vektoren angezeigt werden.

## Betroffene Dateien

- `scripts/ingest_radar.py` — Phase-Correlation aus den letzten 3 CPC-Arrays, `motion`-Block in `frames.json`.
- `src/lib/radar.functions.ts` — `Manifest`/`RadarPayload` um `motion`/`imageOffset` erweitern; Nowcast-Frames generieren; ICON-CH1 im 0–60-min-Fenster gewichten.
- `src/components/maps/radar-map.tsx` — `RadarFrame.imageOffset` lesen, `ImageOverlay`-Bounds verschieben, Timeline-Bubble-Label "Nowcast".

## Out of scope

- Pixel-genaues Optical-Flow pro Zelle (vs. Szenen-Mittelwert) — späterer Schritt, falls nötig.
- Wachstum/Abschwächung der Zellen modellieren (Intensitäts-Trend) — Phase-1 verschiebt nur, ändert keine Werte.
- `region-map.tsx` und Schnee-Layer bleiben unangetastet (kein Radar-Nowcast für Schnee, da CPC = Niederschlag).

## Verifikation

1. Nach nächstem Ingest: `radar/frames.json` enthält `motion: { u_ms, v_ms, confidence }`.
2. Auf `/karten/radar`: Beim Abspielen sieht man, wie die zuletzt gemessene Zelle 10/20/…/60 min in die Wind-Richtung wandert, statt bei `now` auf ein anderes Bild zu springen.
3. Bei leerer Szene (kein Niederschlag): keine Nowcast-Frames erzeugt, Verhalten = heute.
4. Build grün, keine neuen TS-Fehler.
