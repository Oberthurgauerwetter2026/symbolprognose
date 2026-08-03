# Niederschlagsradar: Verzerrung der Prognose-Zellen leicht reduzieren

## Ausgangslage (geprüft)

- In `src/components/maps/radar-map.tsx` wird ein organischer Domain-Warp auf Prognose-Frames angewendet, um eckige Modellränder natürlicher wirken zu lassen.
- Aktuelle Parameter (Zeile 460–471): `ORGANIC_AMP = 0.9`, drei Noise-Oktaven (Frequenzen ca. 0.3 / 0.9 / 2.1, Gewichte 2 : 1 : 0.5).
- Der Nutzer findet die Verzerrung derzeit etwas zu stark.

## Ziel

Die Kantenverzerrung soll subtiler ausfallen: weniger wellenförmige Ausbuchtung, aber weiterhin organisch und ohne Glättung/Weichzeichnung.

## Änderungen

Nur in `src/components/maps/radar-map.tsx`:

1. **Amplitude reduzieren**: `ORGANIC_AMP` von `0.9` auf `0.65` senken. Das reduziert die maximale Auslenkung der Sample-Koordinaten um ca. 28 %.
2. **Feine Oktave leicht dämpfen**: Gewicht der dritten Oktave (`n3`) von `0.5` auf `0.3` verringern. Das nimmt die kleinteilige „Zitterbewegung“ an den Rändern zurück, ohne die grobe Form zu verlieren.
3. **Keine Änderung an Glättung, Farbskala oder Raster**: `smoothEdge`, `ensureSmooth`, bilineare Abtastung und das 15-Minuten-Prognose-Raster bleiben unverändert.

## Erwartetes Ergebnis

Prognose-Zellen behalten unregelmäßige, natürliche Ränder, die aber weniger stark verzerrt wirken. Zellgrösse und Intensität bleiben erhalten.
