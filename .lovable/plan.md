In `src/components/region-map.tsx` die Marker-Pill anpassen, damit Wetter-Icons und Text grösser wirken:

1. **Wetter-Icon**: `size` von 34 auf 40 erhöhen.
2. **Ort-Name** (Label "{name}"): `fontSize` von 10 auf 12.
3. **Temperatur-Werte**:
   - T-Min (daily): `fontSize` von 12 auf 14.
   - Trennzeichen "/": `fontSize` von 10 auf 12.
   - T-Max (daily) & aktuelle Temp (hourly): `fontSize` von 14 auf 16.
4. **Loading-State-Marker**: `fontSize` von 11 auf 12, `iconSize` von [140,28] auf [160,32], `iconAnchor` auf [80,16].
5. **Haupt-Marker**: `iconSize` von [150,44] auf [170,52], `iconAnchor` auf [85,26].
6. **Pill-Padding** leicht vergrössern von `6px 14px 6px 8px` auf `8px 16px 8px 10px`.