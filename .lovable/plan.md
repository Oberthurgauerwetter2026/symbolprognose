## Problem

Der Niederschlags-Radar (Prognose-Modus) verzerrt die Modellzellen mit fraktalem Rauschen (fBm). Aktuell läuft das **pro Bildschirm-Pixel**:

- Auflösung: `STEP = 1` → bei 1737×1241 ≈ **2,1 Mio. Pixel**
- Pro Pixel: **~12 fBm-Aufrufe** (3 Sample-Shifts × 2 Achsen + 4 Envelope-Oktaven + Fracture)
- Pro fBm: **5 Oktaven Value-Noise** mit je 4 Hash-Auswertungen

Macht ~**100 Mio. Hash-Operationen pro Frame** — bei jedem Scrub/Hover wird das neu gerechnet. Daher das Stocken.

## Lösung

Die fBm-Verzerrung ist **räumlich glatt** — sie variiert auf Pixel-Ebene kaum. Wir können sie auf einem groben Gitter vorrechnen und für jeden Pixel bilinear interpolieren. Visuell identisch, ~50–100× schneller.

### Änderungen in `src/components/maps/radar-map.tsx`

1. **Distortion-Cache** (vor der Pixel-Schleife, nur wenn `contour`):
   - Grobes Gitter, z. B. alle **8 Pixel** (`DSTEP = 8`)
   - Pro Gitterpunkt einmal `dX`, `dY`, `envelope`, `mod` berechnen (gleiche fBm-Formeln wie heute)
   - In `Float32Array`s ablegen: `dxGrid`, `dyGrid`, `envGrid`, `modGrid`

2. **In der Pixel-Schleife** statt fBm-Aufrufen:
   - Gitterkoordinaten `gx = lx / DSTEP`, `gy = ly / DSTEP`
   - Bilineare Interpolation der 4 Werte aus den Grids
   - Rest (Sample, Bänder, Schnee, Farbe) unverändert

3. **STEP für Kontur auf 2 erhöhen** (`STEP = contour ? 2 : 2`)
   - Halbiert nochmal die Pixelzahl, Bänder sind diskret → kein sichtbarer Qualitätsverlust
   - Canvas wird wie bisher hochskaliert via `drawImage`

4. **Frame-Cache**: wenn `frame.t` und Viewport unverändert → letztes ImageData wiederverwenden statt neu zu rendern (z. B. via `useRef` mit Key `t|zoom|center`).

5. **Scrub-Throttle**: Slider-Drag-Updates auf ~30 fps drosseln (rAF-coalesced), damit nicht jedes Slider-Tick einen Full-Redraw triggert. Die Render-Funktion selbst bleibt synchron, aber wird nicht öfter als ein rAF angestossen.

### Was bleibt gleich

- Optik der Iso-Bänder, Verzerrung, Fracture, Farben, Schnee-Logik
- Messradar-Pfad (kein `contour`) unverändert
- Keine Änderungen an Datenflüssen, Server-Functions, Caching

### Erwartetes Resultat

- Slider/Hover stocken nicht mehr
- Render einer Prognose-Frame: von ~hunderten ms auf wenige ms
- Visuell unverändert

Soll ich umsetzen?