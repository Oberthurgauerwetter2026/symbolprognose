# Radar-Prognose: weniger Glättung

Die Prognose-Frames (ICON-CH1, `contour=true` im Canvas-Layer) werden aktuell durch drei Stufen geglättet:

1. Bilineares Sampling auf einem halbauflösenden Off-Screen-Buffer (`STEP = 2`).
2. `ctx.filter = "blur(0.3px)"` beim Hochskalieren (`radar-map.tsx:536`).
3. CSS-Filter auf dem Canvas-Element: `contrast(1.35)` (`radar-map.tsx:382`).

Zusammen ergibt das den weichen, „verwaschenen" Eindruck. Ziel: Strukturen der ~2-km-ICON-CH1-Zellen klarer zeigen, ohne den Cartoon-Block-Look zurückzuholen.

## Änderungen (nur Frontend, `src/components/maps/radar-map.tsx`)

1. **Blur entfernen beim Upscale** (Zeile 536/538): `ctx.filter = "blur(0.3px)"` durch `"none"` ersetzen bzw. den Block weglassen. Das ist die deutlichste Glättungsquelle.
2. **CSS-Filter schärfen** (Zeile 382): für Prognose `contrast(1.35)` → `contrast(1.55)` und `imageRendering` auf `"auto"` belassen. Optional zusätzlich `saturate(1.05)`.
3. **`imageSmoothingQuality`** (Zeile 534) für Prognose von `"high"` auf `"medium"` setzen, damit das Upsampling von Buffer→Canvas weniger weichzeichnet. Bilineares Sampling im Buffer bleibt — sonst gibt es harte Pixelblöcke.

Messung (`contour=false`) bleibt unverändert (dort ist der Blur stärker und gewollt, weil das MCH-PNG selbst schon scharf ist).

## Keine Backend-Änderungen

Grid-Auflösung, Bias-Korrektur und Frame-Erzeugung in `src/lib/radar.functions.ts` bleiben gleich — nur die Darstellung wird angepasst.
