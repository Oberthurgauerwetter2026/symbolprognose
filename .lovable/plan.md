# Prognose-Zellen: organischere Umrisse (ohne Glättung)

## Ursache (geprüft)

- Die Prognose-Frames stammen aus den hochauflösenden PNGs im Speicher (`radar/forecast-frames.json`, Version `…v5-ch1-native-pngs`, 134 Frames, alle mit Bild). Ein geprüftes Frame-PNG ist **56 × 48 Pixel** über die Bbox (46.85–48.30 °N, 8.15–10.55 °E) — also ca. **3 km pro Pixel**, nicht 1 km. Der Ingest fährt bewusst mit `GRID_LAT_DENSE: 48` / `GRID_LON_DENSE: 56` (Open-Meteo-Minutenlimit).
- Der organische Domain-Warp (`warpX` / `warpY` in `src/components/maps/radar-map.tsx`) wird **nur im Grid-Werte-Pfad** angewendet (Zeilen ~728 und ~861). Der PNG-/Morph-Renderpfad (`sampleAt` bei Zeile ~1329) samplet ungewarpt — genau dieser Pfad erzeugt das Bild im Screenshot. Deshalb sind dort weiterhin achsenparallele, gerade Kanten sichtbar.
- Zusätzlich ist die Warp-Amplitude mit 0.45 Gitterzellen bei 3-km-Zellen zu klein, um die geraden Farbstufen-Grenzen sichtbar zu brechen.

## Ziel

Gleiche Zellgrösse und Spitzenintensität wie im Modell, keine zusätzliche Glättung oder Weichzeichnung — nur unregelmässigere, natürlichere Umrisse.

## Änderungen (nur `src/components/maps/radar-map.tsx`)

1. **Warp im PNG-/Morph-Pfad anwenden**: Vor der bilinearen Abtastung in `sampleAt` (bzw. an der Aufrufstelle mit `fx`/`fy`) werden die Quellkoordinaten durch `warpX`/`warpY` geschickt — für Prognose-Frames und für die gemorphten Zwischenbilder. Die Radarmessung bleibt ungewarpt.
2. **Amplitude und Oktaven an die 3-km-Zellgrösse anpassen**: `ORGANIC_AMP` von 0.45 auf ca. 0.8–1.0 Quellpixel erhöhen und eine dritte, feinere Oktave ergänzen (Frequenzen ca. 0.3 / 0.9 / 2.1, Gewichte 2 : 1 : 0.5). Das verbiegt Ränder wellenförmig und bricht die geraden Farbstufen-Kanten, ohne Werte zu mitteln — Flächen und Maxima bleiben erhalten.
3. **Warp geo-verankert und zeitunabhängig halten**: Das Noise-Feld bleibt über Quellgitter-Koordinaten definiert (nicht Bildschirmpixel), damit die Formen bei Pan/Zoom stabil sind und beim Abspielen nicht kribbeln.
4. **Restglättung nicht erhöhen**: `smoothEdge` (Zentrum 20) und `ensureSmooth` (Zentrum 12) bleiben unverändert schwach; kein Blur, kein Canvas-Filter.
5. Frame-Canvas-Cache-Key unverändert lassen — der Warp ist deterministisch pro View, also cachefähig.

Nicht Teil der Änderung: Ingest-Skripte, Farbskala, Zeitraster, Summenkarte.

## Erwartetes Ergebnis

Die Prognose-Zellen erhalten gewellte, unregelmässige Umrisse in unveränderter Grösse und Intensität; die Darstellung bleibt scharf.

## Hinweis

Die eigentliche Blockgrösse (~3 km) kommt aus dem Ingest-Raster. Wenn die Zellen auch feiner strukturiert sein sollen, wäre ein separater Schritt nötig: dichteres Punktgitter im Ingest (mehr Open-Meteo-Abfragen, Ratenlimit beachten) oder eine Interpolation auf ein feineres Raster schon beim Rasterisieren der PNGs.
