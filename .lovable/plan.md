In `src/components/maps/radar-map.tsx` den Standard-Zoom des `MapContainer` von `zoom={9.5}` auf `zoom={9}` reduzieren — damit ist beim Aufruf etwas mehr Umland sichtbar. Center bleibt unverändert.

Falls 9 zu weit ist, wäre `9.25` ein Zwischenschritt (zoomSnap=0.5 erlaubt halbe Stufen, also nicht 9.25 — dann 9.0 oder 9.5).