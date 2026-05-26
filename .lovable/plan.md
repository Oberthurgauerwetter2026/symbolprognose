## Ziele

1. **Blobs markanter** wie im Referenz-Screenshot: satte, klar abgrenzbare Farbringe innen, weicher halb-transparenter Halo aussen — nicht so weichgespült wie aktuell.
2. **Niederschlag bis an die Karten-Ränder** sichtbar (aktuell endet er an der Daten-Bbox 8.85–9.85 / 47.30–47.85, dahinter ist nichts).

## Änderungen in `src/components/maps/radar-map.tsx`

### A. Markantere Blobs

1. **Blur reduzieren, Sättigung/Kontrast erhöhen**
  `cv.style.filter = "blur(6px) saturate(1.15) contrast(1.05)"`
   → `"blur(3px) saturate(1.4) contrast(1.2)"`.
   Weniger Weichzeichnung = klar erkennbare Farbbänder; mehr Sättigung/Kontrast = Look wie im Screenshot.
2. **Alpha-Kurve voll auf 1.0 im Kern**
  In `colorFor()`:
   `a = Math.min(1.0, 0.85 + (i/SCALE.length)*0.15)`
   → `a = Math.min(1.0, 0.95 + (i/SCALE.length)*0.05)` (0.95 … 1.00).
   Innen praktisch opak; der weiche Halo entsteht über den Edge-Fade + Blur.
3. **Mehr Farb-Stops am unteren Ende komprimieren** *(optional, klein)*
  Aktuell erster Farbstop bei 0.1 mm/h sehr hell. Schwellen bleiben gleich, aber unterster Stop wird minimal kräftiger:
   `{ mmh: 0.1, rgb: [170,205,240] }` → `{ mmh: 0.1, rgb: [150,190,235] }`.
   Das erzeugt den deutlich sichtbaren blauen Aussenring wie im Screenshot.

### B. Niederschlag über die ganze Karte

Aktuell wird jeder Pixel ausserhalb des Grids per `continue` übersprungen. Die Daten-Bbox ist nur ~5 km kleiner als die Karten-Maxbounds — das entspricht ca. **1 Grid-Zelle Puffer**.

Neuer Ansatz: **Nearest-Edge-Clamp mit begrenztem Puffer und Edge-Fade**:

```ts
const BUFFER = 1.5; // Grid-Zellen, die per Clamp extrapoliert werden
if (fxRaw < -BUFFER || fxRaw > nLon - 1 + BUFFER) continue;
if (fyRaw < -BUFFER || fyRaw > nLat - 1 + BUFFER) continue;
const fx = Math.max(0, Math.min(nLon - 1, fxRaw));
const fy = Math.max(0, Math.min(nLat - 1, fyRaw));
// … bilinear sampling auf fx/fy (statt fxRaw/fyRaw)
const edgeDist = Math.min(fxRaw, nLon-1-fxRaw, fyRaw, nLat-1-fyRaw);
// edgeDist <0 = ausserhalb. Fade-Bereich = 0.5 innen + ganze 1.5 ausserhalb.
const edgeFade =
  edgeDist >= 0.5 ? 1 :
  edgeDist >= -BUFFER ? Math.max(0, (edgeDist + BUFFER) / (BUFFER + 0.5)) : 0;
```

Effekt:

- Innen (≥ 0.5 Zellen vom Rand): voll deckend.
- Im 0.5-Zellen-Randbereich des Grids: Fade beginnt.

&nbsp;

Zusätzlich in der Prognose Schneefallgrenze einbauen und unterscheiden zwischen Schnee und Regen.