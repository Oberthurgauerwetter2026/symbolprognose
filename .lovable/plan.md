## Problem
Der Schriftzug "3-h-Takt" existiert bereits im Code (`weather-widget.tsx` Zeile 864–868), wird aber durch `overflow-hidden` am umgebenden `<section>`-Container (Zeile 730) abgeschnitten, da er absolut positioniert über die obere Kante des Slots ragt (`absolute -top-px -translate-y-full`).

## Lösung
Das Label wird nicht mehr absolut über dem Slot-Rand platziert, sondern als sichtbares, statisches Element **innerhalb** des ersten 3h-Slots oberhalb der Uhrzeit angezeigt. Dadurch bleibt es im sichtbaren Bereich und wird nicht von `overflow-hidden` abgeschnitten.

## Technische Umsetzung
- In `weather-widget.tsx`:
  1. Den `absolute -top-px -translate-y-full`-Block (Zeile 864–868) entfernen.
  2. Stattdessen direkt über der `<div>` mit der Uhrzeit (Zeile 869–875) ein kleines, statisches Label `"3-h-Takt"` im gleichen Stil (`text-[9px] font-bold uppercase tracking-wider text-zinc-500`) einfügen, wenn `isCadenceBreak === true`.
  3. Optional: Den Platz innerhalb des Slots um ein paar Pixel vergrößern, damit das Label nicht alles quetscht.

Keine weiteren Dateien betroffen.