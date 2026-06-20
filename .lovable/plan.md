## Problem

Beim Hover/Tap erscheint der Tooltip oben links in der Ecke statt über dem Balken.

## Ursache

In `TapTooltip` (src/components/weather-widget.tsx, ~Z. 50-94) wird der Trigger in ein zusätzliches `<span style={{ display: "contents" }}>` gewickelt und dieses per `TooltipTrigger asChild` an Radix übergeben. Ein Element mit `display: contents` hat **keine eigene Bounding-Box**. Radix/Floating-UI misst dadurch die Position als (0,0) und positioniert den Tooltip in der oberen linken Bildschirmecke.

## Fix

`TapTooltip` so umbauen, dass der **echte Child-Knoten** der Trigger ist — kein zusätzliches Wrapper-Span:

- `React.cloneElement(children, { ref, onClick })` verwenden, um Ref + Tap-Toggle direkt auf das vorhandene Balken-`<div>` zu legen.
- Bestehendes `onClick` des Childs vorher zwischenspeichern und nach dem Toggle aufrufen (wie heute).
- Ref via Callback-Ref mergen (eigene `triggerRef.current` setzen und ggf. bestehende Ref des Childs weiterleiten).
- Das Resultat unverändert in `<TooltipTrigger asChild>{cloned}</TooltipTrigger>` einsetzen.

Keine weiteren Änderungen: Hover (Desktop), Outside-Tap (Mobile), `side`, Inhalt, beide Aufrufstellen (Z. 715 und Z. 1209) und das umgebende Layout bleiben gleich.

## Verifikation

- Desktop: Hover über Stundenbalken → Tooltip erscheint korrekt **über dem Balken**.
- Mobile: Tap → Tooltip am Balken, Tap ausserhalb schliesst.
- `npx tsc --noEmit` bleibt grün.
