## Ziel
Messungs-NS sauber (keine Körnung/Speckle), trotzdem organische Konturen — keine 1-km-Quadrate.

## Ursache
Die fbm-Modulation `v = v * (0.94 + n*0.12)` in `MeasurementCanvasOverlay` (radar-map.tsx Zeile 1264–1273) erzeugt pro Pixel ±6 % Zufallsrauschen. Sichtbar als feine Körnung / "schmutzige" Flecken — das sind die Unreinheiten.

Die organische Form der Niederschlagsflächen entsteht bereits aus zwei sauberen Quellen:
1. Bilineare 4-Tap-Subpixel-Abtastung in `sampleAt` (Zeile 1198–1217) glättet das 1-km-Raster.
2. Harte Farbbänder von `colorFor` werden durch die kontinuierliche v-Interpolation an den Bandgrenzen automatisch zu geschwungenen Isolinien.

→ Wir können das gesamte fbm-Rauschen ersatzlos streichen, ohne die organische Form zu verlieren.

## Änderungen (nur `MeasurementCanvasOverlay`)

1. **fbm-Block + Hash/Noise-Helpers entfernen** (Zeile 1219–1273): Lösche den Kommentar-Block "Organische Iso-Konturen…", die Funktionen `hash`, `smooth`, `valueNoise`, `fbm`, die Konstanten `COS`/`SIN` und im Loop die Zeilen `sx`, `sy`, `rx`, `ry`, `warpX`, `warpY`, `n`, `mod`, `v = v * mod`. Schwelle `if (v < 0.05) continue;` bleibt — fängt Sampling-Rauschen am Rand auf.

2. **Sanftes Box-Filter über das v-Feld** als Ersatz für die organische Variation: Vor dem Loop einen 1-Pass-3×3-Mittelwert auf `src.mmh` legen (in lokale `Float32Array` der Größe `src.w*src.h`), damit Bandgrenzen geschmeidig laufen und keine sichtbare 1-km-Kante übrigbleibt. Per Frame cachen (WeakMap keyed auf `src`), damit Pan/Zoom nicht mehrfach blurrt.

3. Alles andere bleibt: `colorFor` (harte Bänder), bilineares `sampleAt` auf dem geglätteten Feld, `imageSmoothingQuality = "high"` beim Upscale.

## Nicht angefasst
Forecast-Layer (`PrecipOverlay`), Hagel, Filmstrip, Farbskalen.

## Verifikation
`/karten/radar` → Messung-Frames: keine Körnung/Speckle mehr sichtbar, Flächen sauber; Ränder weiterhin organisch-geschwungen, keine 1-km-Quadrate. Forecast unverändert.
