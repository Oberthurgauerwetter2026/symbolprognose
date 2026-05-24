## Ziel
Aktuell muss man bei den Stundenlabels unter dem Slider exakt auf den Slider-Track klicken, um die Zeit zu ändern. Die Stundenleiste (Ticks + Labels wie "06:00", "09:00" …) ist `pointer-events-none` und reagiert nicht auf Klicks. Gewünscht: Ein Klick/Tap irgendwo in den Bereich der Stundenleiste soll automatisch auf die nächstgelegene Stunde wechseln.

## Änderung in `src/components/region-map.tsx`

Stundenlegende-Container (aktuell `pointer-events-none mt-1 px-1`) klickbar machen:

- `pointer-events-none` entfernen, stattdessen `cursor-pointer` setzen
- `onPointerDown`-Handler hinzufügen, der:
  - die x-Position relativ zur Breite berechnet
  - daraus `Math.round((x / width) * MAX_STEPS)` ermittelt
  - auf `[0, MAX_STEPS]` clamped
  - `setStepOffset(...)` aufruft
- Im `daily`-Modus weiterhin deaktivieren (kein Handler, `pointer-events-none` + `opacity-40` bleibt)
- Einzelne Tick-/Label-`<span>`s erhalten `pointer-events-none`, damit die Klicks immer den Container treffen (saubere Koordinaten)

Der Radix-Slider selbst behält sein bestehendes Klick-/Drag-Verhalten — die Stundenleiste wird damit zur zusätzlichen, größeren Klickfläche, die exakt auf volle Stunden snappt.

## Nicht betroffen
- `src/components/ui/slider.tsx` bleibt unverändert
- Keine Änderung an Datenlogik, Tooltip oder Marker-Linie