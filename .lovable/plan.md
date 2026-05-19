## Änderung

In der stündlichen Ansicht (`src/components/weather-widget.tsx`) zusätzlich zur bereits vorhandenen Tages-Trennlinie in den Regen-/Sonnen-Charts auch in der **oberen Slot-Reihe** (Uhrzeit/Icon/Temp/Wind) eine vertikale Trennlinie vor jedem 00:00-Slot einfügen.

- Im Slot-`map` (ab Zeile 552): `isDayStart` analog zu den Charts berechnen (`prevIso.slice(0,10) !== iso.slice(0,10)`), und wenn `isDayStart && i > 0`, links am Slot via `border-l border-zinc-300` (oder absolutes 1px-Div) eine durchgehende Trennlinie zeichnen, die optisch mit den Chart-Trennlinien fluchtet.

Keine weiteren Änderungen.