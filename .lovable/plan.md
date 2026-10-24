# Tropfen im Schneeregen etwas kleiner

Die weissen Tropfen im Schneeregen auf der Radarkarte werden etwas kleiner: von ca. 5 × 7 auf ca. 3 × 5 Bildpunkte. Die Tropfenform bleibt gleich (Spitze oben, runder Bauch). Abstand und Anzahl der Tropfen, die Flocken und der Ein/Aus-Knopf bleiben unverändert.

## Technisch
- `src/components/maps/radar-map.tsx`, `isDropPixel`: Silhouette verkleinern — dy −2: dx 0; dy −1/0: |dx| ≤ 1; dy 1: |dx| ≤ 1; dy 2: dx 0 (bzw. schmaler Abschluss).
- Gilt automatisch für Messung und Prognose, da beide dieselbe Funktion nutzen.
