## Radar/Prognose-Overlay leicht transparenter

`src/components/maps/radar-map.tsx`:
- Niederschlags-Overlay (Messung **und** Prognose): `opacityVal` von **0.95 → 0.75** (Zeile 999). Wirkt für PNG-Messung und Canvas-Prognose gleichermassen, weil beide diesen Wert benutzen.
- Hagel-Overlay (POH): von **0.95 → 0.8** (Zeile 1050), damit es konsistent mit dem Niederschlag ist.

Keine Änderungen an Crossfade-Logik, Datenfluss oder Slider. Reliefkarte wird dadurch durch beide Overlay-Typen sichtbarer.