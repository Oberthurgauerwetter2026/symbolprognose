# Organischere Niederschlagsformen in der Prognose

## Ausgangslage (geprüft)

- Prognose-Frames werden in `src/components/maps/radar-map.tsx` an drei Stellen aufbereitet: zwei `smoothEdge`-Funktionen für Grid-Frames (Zeilen ~573 und ~760) und `ensureSmooth` im PNG/Morph-Pfad (Zeile ~990). Alle drei verwenden eine schwach gewichtete Kantenglättung (Zentrum 12, 4er-Nachbarn 1).
- Beim Rendern werden Werte bilinear aus dem Modellgitter (~1,3 km/Pixel) auf ein Bildraster (STEP 2 px) gesampelt. Dadurch entstehen achsenparallele, rechteckig-treppige Ränder — die Formen wirken „modellig“ statt organisch.

## Ziel

Zellränder sollen unregelmäßiger und natürlicher verlaufen, ohne zusätzliche Glättung oder Weichzeichnung: gleiche Zellgröße, gleiche Spitzenintensität, gleiche Farbstufen — nur die Kantenverläufe werden gebrochen.

## Änderungen (nur `src/components/maps/radar-map.tsx`, reine Darstellungsschicht)

1. **Domain-Warp beim Sampling statt Glättung**: Vor der bilinearen Abtastung werden die Gitter-Koordinaten (`sx`, `sy`) um einen kleinen, glatten Rauschbetrag verschoben (Amplitude ca. 0,25–0,4 Gitterzellen, zwei Oktaven Value-Noise). Das verbiegt Ränder wellenförmig, ohne Werte zu mitteln — Maxima und Flächen bleiben erhalten.
2. **Deterministisches, geo-verankertes Rauschen**: Das Noise-Feld wird über Gitterkoordinaten (nicht Bildschirmpixel) definiert, damit die Formen bei Pan/Zoom stabil bleiben und beim Abspielen nicht „kribbeln“. Das Feld ist zeitunabhängig, sodass keine Flimmereffekte über die Frames entstehen.
3. **Kantenglättung reduzieren**: Da der Warp die Treppen bereits bricht, wird die verbleibende `smoothEdge`/`ensureSmooth`-Gewichtung noch schwächer gesetzt (Zentrum 20 statt 12) — oder ganz entfernt, falls die Kanten damit zu hart wirken. Kein zusätzlicher Blur, kein Canvas-Filter.
4. Anwendung nur auf Prognose-Frames (`frame.source !== "radar"`) und im Morph-Pfad; die Radarmessung bleibt unverändert.

Nicht Teil der Änderung: Ingest-Skripte, Farbskala, Zeitraster, Summenkarte.

## Erwartetes Ergebnis

Prognose-Zellen erhalten unregelmäßige, gewachsene Umrisse in unveränderter Größe und Intensität; die Darstellung bleibt scharf, ohne Weichzeichnung.
