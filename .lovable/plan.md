## Änderungen

### 1) `src/components/maps/radar-map.tsx` — mehr Smoothing bei Messung
- Messung-Render (Z. 711-712): `imageSmoothingQuality` von `"low"` auf `"high"` heben. Prognose-Render bleibt bei `"low"`.

### 2) `src/components/maps/radar-map.tsx` — Filmstrip auf Kartenbreite
- Z. 2036-2038: `mx-auto w-full max-w-3xl` → `w-full`. Damit nimmt das Steuer-/Filmstrip-Panel im Nicht-`bare`-Modus dieselbe Breite wie die Karte ein. `bare`-Mode bleibt unverändert.

## Verifikation
- `bunx tsgo --noEmit` grün.
- `/karten/radar`: Messungs-Ns wirkt weicher (keine sichtbaren Pixelkanten), Filmstrip läuft auf voller Kartenbreite.
