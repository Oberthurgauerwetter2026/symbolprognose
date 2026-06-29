## Ziel
Messungs-NS klarer/satter, aber ohne 1-km-Quadrate oder Pixelraster.

## Ursache
`MeasurementCanvasOverlay` (radar-map.tsx ab Zeile 1168) kombiniert drei Weichmacher gleichzeitig:
1. `colorForSmooth` (log-interpolierte Übergänge zwischen Bändern) → Farben "wandern" statt klarer Isolinien
2. fbm-Modulation `v = v * (0.85 + n*0.30)` → ±15 % zufällige Intensitätsverschiebung
3. `imageSmoothingQuality = "low"` beim Upscale → unscharfes Bilinear

Zusammen wirken die Messungen wässrig/verwaschen.

## Änderungen (nur `MeasurementCanvasOverlay`, Forecast bleibt unverändert)

1. **Harte Bänder zurück** (Zeile 1276): `colorForSmooth(v)` → `colorFor(v)`. Gibt scharfe MCH-CombiPrecip-Isolinien, statt verschwommener Farbverläufe. Das eigentliche "Weichzeichnen" gegen die 1-km-Quadrate übernimmt die bilineare Subpixel-Abtastung in `sampleAt` (bleibt erhalten) — Bänder werden dadurch automatisch zu organischen Kurven, nicht zu Rechtecken.

2. **fbm-Modulation deutlich schwächer** (Zeile 1272): `mod = 0.85 + n * 0.30` → `mod = 0.94 + n * 0.12`. Nur noch ±6 % Variation — gerade genug, um die Quadrat-Kanten aufzubrechen, ohne die Intensität zu verschieben oder Bänder hin- und herhüpfen zu lassen.

3. **Upscale-Qualität hoch** (Zeile 1291): `imageSmoothingQuality = "low"` → `"high"`. Erhält knackige Kanten beim Hochskalieren auf Bildschirmauflösung, ohne sichtbares Pixelraster.

## Nicht angefasst
- `colorFor` / `colorForSmooth` Definition, SCALE-Schwellen
- Forecast-Layer (`PrecipOverlay`), Hagel-Layer, Filmstrip/Cadence-Logik
- Bilineare 4-Tap-Interpolation in `sampleAt` (notwendig gegen Quadrate)

## Verifikation
`/karten/radar` öffnen: Messung-Frames (t ≤ jetzt) zeigen klare Farbbänder ähnlich MCH-CombiPrecip, Ränder sind weich-organisch (keine 1-km-Quadrate sichtbar), aber Farben sind nicht mehr ausgewaschen. Prognose-Frames bleiben optisch identisch zu vorher.
