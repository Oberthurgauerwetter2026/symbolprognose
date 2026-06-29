## Drei Korrekturen

### 1. Messung organisch wie Prognose, ohne Quantisierungs-„Unreinheiten"

Aktuell rendert `MeasurementCanvasOverlay` (Lines ~893–1112) das MCH-CombiPrecip-PNG so:
- PNG → mm/h-Grid via Nearest-Match in `SCALE` (8 harte Bänder).
- Bilineares Resampling → `colorFor()` (harte Bänder erneut).
- Canvas mit `imageRendering: pixelated`.

Folgen (im Screenshot sichtbar):
- Rechteckige Stufen entlang der nativen 1-km-Pixel.
- „Stippling"/Unreinheiten: bilineare Werte zwischen zwei Bändern fallen je nach Sample auf die eine oder andere Bande → einzelne falsch eingefärbte Mini-Pixel innerhalb einer Zelle.

**Änderungen (nur `src/components/maps/radar-map.tsx`, `MeasurementCanvasOverlay`):**

a. **Glatte Farbskala**: `colorFor(v)` → `colorForSmooth(v)` (existiert bereits in der Datei, log-interpoliert zwischen Bändern). Eliminiert die Stippling-Unreinheiten direkt.

b. **Organische Kanten**: dieselbe `contour`-Warping-Logik aus `PrecipOverlay` (Lines 539–608: fbm-Noise → `contourScale`) in den Messungs-Renderpfad übernehmen. View-abhängiger Lookup wird einmal pro Pan/Zoom berechnet (genau wie Prognose) und pro Frame wiederverwendet. Resultat: weiche, unregelmässige Iso-Konturen statt rechteckiger 1-km-Blöcke.

c. **`imageRendering: pixelated` entfernen** auf dem Messungs-Canvas (bleibt für Prognose unverändert nicht nötig, weil Lookup bereits per Pixel rendert) → Subpixel-Glättung beim Skalieren bleibt aus, harte Pixel sind aber nicht mehr durchgängig sichtbar.

d. **`STEP` erhöhen** (z. B. 2 wie Prognose-Contour-Modus), damit die fbm-Modulation pro 2×2-Block läuft und nicht in feinen Pixelmustern unruhig wirkt.

e. **Kein Crossfade**: Layer bleibt frame-genau (heutiges Verhalten), nichts zu ändern.

### 2. Prognose-NS bewegt sich strikt im 15-min-Takt

Backend liefert bereits 15-min-Frames mit Wind-Advektion (`src/lib/radar.functions.ts`, `advectedForecast`). Symptom „bewegt sich nicht" hat zwei mögliche Ursachen:

a. **Hour-Index-Miss**: `meanWindAt(hMs)` schaut in `r1HourIdx`/`r2HourIdx` per exaktem ms-Schlüssel. Wenn die Map-Keys eine andere Rundung haben (`Date.parse` vs. `Math.floor(.../3600_000)*3600_000`), greift kein Wind → `u=v=0` → keine Bewegung. Prüfen und auf gemeinsame Schlüssel-Normalisierung (`Math.floor(ts/3600_000)*3600_000`) angleichen.

b. **Verschiebung zu klein**: `ADVECT_SCALE = 0.7` × Bodenwind. Bei 3 m/s = 7,5 km/h ergibt 15 min × 0,7 nur ≈ 1,9 km — auf der Karte gerade noch sichtbar. **Fix**: 
   - `ADVECT_SCALE` auf `1.0` (Bodenwind ist konservativ; bei Konvektion zieht NS ungefähr mit dem Boden- bis 700hPa-Mittel).
   - Wenn `wind_speed_700hPa` im Cache vorhanden ist (Phase 2 hat es), 700hPa-Wind bevorzugen (näher an der Zellzugbahn).
   - Kappung bei 30 m/s bleibt.

c. **Diagnose-Log**: einmaliger `console.log` der mittleren u/v pro Stunde im Forecast-Aufbau, damit künftig sofort sichtbar ist, ob Wind gezogen wird (entfernen wir später wieder).

### 3. Was bewusst NICHT passiert
- Kein Crossfade zwischen Frames (weder Messung noch Prognose).
- Keine zeitliche Glättung der Intensitäten.
- Keine Mischung von Messung mit Modell.
- Kein Verändern der Farbskala in Messung — nur Übergänge zwischen Bändern werden glatt.

## Verifikation

- `/karten/radar`, Messung jetzt: NS-Felder zeigen organisch geschwungene Iso-Konturen wie in der Prognose; keine rechteckigen 1-km-Blöcke, keine einzelnen falschfarbigen Pixel innerhalb einer Bande.
- Prognose Play/Scrub im 15-min-Takt: NS-Zellen wandern sichtbar zwischen den 15-min-Frames in Windrichtung.
- Console-Log bestätigt mittlere u/v pro Forecast-Stunde ≠ 0.
- Typecheck grün.
