## Ziel

Die Prognose-Frames der Radarkarte (`contour=true` in `PrecipOverlay`, d.h. alle ICON-CH1/CH2-Frames) sollen nicht mehr als pixelgerasterte Bänder gezeichnet werden, sondern als radarähnliche, organische Niederschlagsfelder: **eine unregelmäßige Ellipse pro Zelle als äußere Hülle, darin nach innen geschachtelte, leicht zufällig deformierte Skalierungen derselben Grundform für jede Intensitätsstufe** — keine geraden Linien, keine 90°-Ecken.

Messung-Frames (Radar-PNG, `source === "radar"`) bleiben unverändert.

## Umsetzung in `src/components/maps/radar-map.tsx`

### 1. Niederschlags-Zellen aus dem Grid extrahieren

Innerhalb von `PrecipOverlay.redraw` (nur wenn `contour === true`):

1. Aus `frame.values` (+ optional `nextFrame.values` interpoliert mit `progress`) ein geglättetes 2D-Feld auf dem Modell-Grid bauen (1× Box-Blur, 3×3).
2. Connected-Components-Suche auf der Maske `v > 0.05 mm/h`. Zellen mit Fläche `< 4` Grid-Zellen verwerfen (Rauschen).
3. Pro Zelle berechnen:
   - gewichteter Schwerpunkt `(cx, cy)` (Gewicht = `v`),
   - Kovarianzmatrix → Eigenwerte/-vektoren → Rotation `φ`, Halbachsen `a`, `b` (skaliert so, dass die 2σ-Ellipse die Zelle umschließt),
   - Maximum-Intensität `vMax`, Summe `vSum` (für spätere Scoring/Sortierung).

### 2. Grundform: unregelmäßige Ellipse via mehrskaligem Noise

Pro Zelle eine Funktion `r(θ)` definieren:

```
r(θ) = 1 + Σ_{k=1..4} A_k · fbm( f_k · cos θ , f_k · sin θ , seed_zelle )
```

- 4 Oktaven mit Frequenzen `f_k ∈ {1, 2.1, 4.3, 8.7}` und Amplituden `A_k ∈ {0.25, 0.12, 0.06, 0.03}` (→ markante Lobus-Struktur + feine Krümmung).
- Eingabe in `cos/sin θ` statt direkt `θ`, damit `r` periodisch und C¹-stetig in `θ ist (keine Naht bei 0/2π).
- `seed_zelle` aus Frame-Zeit + Zellindex, deterministisch (kein Flackern).
- Wiederverwendung des vorhandenen `valueNoise`/`fbm`, aber mit 2D-Input.

Die äußere Kontur ist dann: `P_out(θ) = center + Rot(φ) · ( a · r(θ) · cos θ , b · r(θ) · sin θ )`.

### 3. Innere Intensitätsstufen

Für die Bänder (gleiche Schwellen wie `colorFor`, z. B. `0.1, 0.5, 2, 5, 10, 20 mm/h`, nur solange `≤ vMax`):

- Skalierungsfaktor `s_i = sqrt( (vMax − v_i) / vMax )` (innerste Stufe ≈ 0, äußerste = 1) — so wachsen die Bänder physikalisch plausibel nach innen.
- Pro Band `r_i(θ) = s_i · r(θ) + ε_i · noise2( θ, seed_band )` mit kleinem ε_i (≈ 0.04 · s_i). So bleibt die Grundform erhalten, jede Stufe bekommt aber eine eigene leichte Deformation.
- Farbe = `colorFor(v_i)` (vorhandene Skala, inklusive Schnee via `snowColorFor`, basierend auf `snowFrac` am Zentrum der Zelle).

### 4. Rendering ohne Geraden / 90°-Ecken

- 128 Stützpunkte pro Ring (Schrittweite ~2.8°).
- Pfad als **geschlossene Catmull-Rom-Spline → kubische Bézier-Konvertierung** zeichnen (Standardformel, Tension 0.5). Damit hat jede Kontur C¹-Stetigkeit und garantiert keine geraden Kanten / rechte Winkel.
- Painter's-Order: äußerstes Band zuerst, innen drauf — keine Even-Odd-Tricks nötig.
- Auf der Karte gerendert über `map.latLngToContainerPoint(...)` für jeden Stützpunkt; die Halbachsen `a, b` werden in Grad → Pixel via Differenz zweier projezierter Punkte umgerechnet, damit Zoom-Stufen sauber skalieren.

### 5. Restliche Logik

- `STEP`, `createImageData`, das gesamte Pixel-Loop und der Off-Screen-Buffer werden im `contour`-Pfad **durch Vektor-Rendering ersetzt**. Im `else`-Pfad (Messung-Fallback ohne PNG) bleibt der bisherige Pixel-Code.
- `imageRendering: "pixelated"` für Contour-Modus entfernen (Vektor → `auto`).
- `opacityVal = 0.60` (aktueller Wert) und Cross-Fade zwischen Frames bleiben.
- Hagel-Dots (`hailValues`) unverändert.

### Technische Notizen

- Connected-Components: iterative BFS auf flachem Array, kein zusätzlicher Speicher außer einem `Uint8Array(nLat*nLon)` Besucht-Flag.
- Kovarianz-Eigenwerte einer 2×2-Matrix in geschlossener Form (kein Lib-Abhängigkeit).
- Catmull-Rom → Bézier: `cp1 = P1 + (P2 − P0)/6`, `cp2 = P2 − (P3 − P1)/6`.
- Performance: maximal ~30–60 aktive Zellen, 128 Punkte, 5 Bänder → ~10k Bézier-Segmente pro Redraw → unkritisch im Vergleich zur jetzigen Per-Pixel-Schleife.

### Verifikation

- Build/TypeScript grün.
- Visuelle Prüfung in `/karten/radar` während eines Prognose-Frames: weiche, blob-artige Felder, sichtbare innere Intensitätskerne, keine geraden Kanten oder Pixel-Treppen, Position der Felder konsistent mit ICON-CH1.
- Messung-Frames (rückblickend) sehen aus wie bisher.

## Dateien

- `src/components/maps/radar-map.tsx` — `PrecipOverlay` (contour-Pfad neu) und Hilfsfunktionen für Komponenten-Erkennung, Ellipsen-Fit, Noise-Ring, Catmull-Rom-Pfad.
