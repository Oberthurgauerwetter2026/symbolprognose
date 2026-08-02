# Niederschlagsradar: Zeitraster im Filmstrip

## Ziel
Messung weiterhin in 5-Minuten-Schritten, Prognose in gröberen Schritten, damit man nicht durch viele „leere“ Zwischenpositionen scrollt.

## Ausgangslage (verifiziert im Code)
- `src/components/maps/radar-map.tsx` baut ein durchgehendes 5-min-Raster: Messzeitpunkte snappen auf echte Radarframes, Prognosezeitpunkte werden virtuell erzeugt und per Optical-Flow-Morphing zwischen den Prognosebildern interpoliert.
- `scripts/ingest_openmeteo.py` rastert die Prognose-PNGs aus ICON-CH1 `minutely_15`, also nominell in 15-min-Slots (nicht stündlich). Ob im laufenden Betrieb tatsächlich nur stündliche Frames im Manifest landen, ist offen — das prüfen wir als ersten Schritt am aktuellen `radar/forecast-frames.json`.

## Vorgehen
1. Prüfen, welche Zeitstempel die Prognose-Frames real haben (15 min oder 60 min).
2. Zeitraster in `timelineSteps` aufteilen:
   - Vergangenheit/Jetzt: 5-min-Schritte, wie heute auf echte Frames gesnappt.
   - Zukunft: Schrittweite = tatsächliche Frame-Kadenz (60 min bzw. 15 min), Positionen exakt auf die vorhandenen Prognose-Frames gesetzt.
3. Übergang Messung → Prognose sauber halten (kein doppelter Schritt am Umschaltpunkt), Wiedergabe-Timing anpassen: pro Prognoseschritt eine etwas längere Anzeigedauer, damit der Loop nicht durch die Zukunft „rast“.
4. Interpolation beibehalten: Beim Abspielen wird zwischen zwei Prognose-Frames weiterhin flüssig gemorpht, aber der Slider rastet nur auf echte Frame-Zeiten.
5. Zeitachsen-Labels: Prognosemarkierungen als Stundenmarken kennzeichnen, damit klar ist, dass dort ein gröberes Raster gilt.

## Alternative Möglichkeiten
- **A (empfohlen)**: gemischtes Raster wie oben — 5 min Messung, echte Frame-Kadenz in der Prognose. Ehrlichste Darstellung, keine leeren Zwischenschritte.
- **B**: Prognose weiterhin 5 min, aber Slider-Schritte in der Zukunft optisch als „interpoliert“ markieren. Flüssiger Scrub, jedoch bleibt das Scrollen lang.
- **C**: Prognose auf 15 min ingesten (falls aktuell stündlich) und dann 15-min-Schritte anzeigen. Bester Kompromiss aus Detail und Länge, hängt aber an der Datenverfügbarkeit von ICON-CH1.

Vorschlag: A umsetzen und dabei die Schrittweite automatisch aus den Daten ableiten — läuft die Prognose später wieder in 15 min, passt sich der Filmstrip von selbst an (damit ist C ohne Zusatzarbeit mitgedeckt).

## Technische Details
- Änderungen nur in `src/components/maps/radar-map.tsx`: `timelineSteps`, `cursorForMs`, Playback-Effekt (Schrittdauer je nach Mess-/Prognosebereich) und Slider-Beschriftung.
- Keine Backend-/Ingest-Änderungen nötig, sofern Schritt 1 keine fehlenden Frames zeigt.
