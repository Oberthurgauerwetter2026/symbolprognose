## Ziel
Crossfade-Logik wieder entfernen — harte Framewechsel, aber **kein Flackern** beim Layer-Swap.

## Ursache des Flackerns
Beim Framewechsel wird das alte `<ImageOverlay>` unmounted und das neue gemountet. Zwischen Unmount und sichtbarem neuen Bild entsteht ein kurzer Leerframe → Aufblitzen.

## Fix (`src/components/maps/radar-map.tsx`)

**Doppel-Layer ohne Fade**: zwei `<ImageOverlay>` permanent gemountet, beide volle Opacity:
- **Hinten** (zIndex 460): vorheriger Frame, bleibt sichtbar bis verdeckt wird.
- **Vorne** (zIndex 461): aktueller Frame, volle Deckkraft.

Beim Framewechsel rutscht der bisherige "vordere" Frame nach hinten und der neue erscheint vorne. Da alle PNGs durch den bereits implementierten Preload im Browser-Cache liegen, ist der neue Frame sofort sichtbar — der hintere alte Frame verdeckt etwaige Mikrolücken.

Konkret:
- `blendNextPng` und das `progress`-Crossfade-Fenster entfallen.
- Neuer State `prevFrame` (Ref auf den vorherigen `currentFrame`), aktualisiert in einem `useEffect` wenn `currentFrame.t` wechselt.
- Render:
  ```tsx
  {prevFrame?.precipUrl && (
    <ImageOverlay key={`precip-prev-${prevFrame.t}`} url={prevFrame.precipUrl!} ...
      opacity={opacityVal} zIndex={460} />
  )}
  {hasPng && (
    <ImageOverlay key={`precip-${currentFrame.t}`} url={currentFrame.precipUrl!} ...
      opacity={opacityVal} zIndex={461} />
  )}
  ```

Im Pause-Modus identisch — `prevFrame` bleibt einfach gleich dem `currentFrame` oder `null`.

## Out of scope
- PNG-Preload (bereits drin) bleibt — Voraussetzung für sofortigen Swap.
- Canvas-Forecast-Pfad, Hagel-Overlay, Farbskala, Server-Logik unverändert.
