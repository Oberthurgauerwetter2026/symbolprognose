# Prognose zurück auf Stundentakt — Fade an den Reglerschritt binden

## Befund: ICON-CH1 liefert keine echten 15-Minuten-Felder

Direkte Prüfung der Datenquelle (Open-Meteo, `models=meteoswiss_icon_ch1`, `minutely_15=precipitation`) an mehreren Punkten in der Schweiz zeigt: die Werte sind innerhalb jeder Stunde in Blöcken von vier identisch, z. B.

```text
17:15  0.1    18:15  6.6
17:30  0.1    18:30  6.6
17:45  0.1    18:45  6.6
18:00  0.1    19:00  6.6
```

Das 15-Minuten-Raster ist also nur eine Aufteilung der Stundenfelder — kein zusätzlicher Informationsgehalt. Folge der jetzt umgesetzten 15-Minuten-Kadenz: drei von vier Reglerschritten zeigen dasselbe Bild, danach kommt der Sprung. Das ist schlechter als vorher.

## Was sich ändert

- Der Prognoseteil des Zeitreglers geht zurück auf **Stundenschritte** (ein Schritt = ein echtes ICON-CH1-Feld), Messung bleibt 5-Minuten-Takt.
- Der weiche Übergang wird nicht mehr aus dem Feldabstand der Rohdaten, sondern aus dem **angezeigten Stundenschritt** berechnet. Damit blendet die Prognose vom aktuellen Stundenfeld über die ganze Stunde ins nächste — auch in den ersten 24 Stunden, wo bisher hart geschnitten wurde.
- Die 15-Minuten-Zwischenbilder werden nicht mehr als Fade-Ziel verwendet.
- Fade-Kurve, Fade-Fenster und Farbdichte bleiben unverändert; Messung bleibt hart geschnitten.
- Play und manuelles Scrubben verhalten sich identisch.

## Technische Umsetzung

Nur `src/components/maps/radar-map.tsx`:

- `timelineSteps`: die neu eingefügte 15-Minuten-Phase entfernen, Prognoseteil wieder als reines 60-Minuten-Raster (Toleranz 4 min, nur echte Feldzeitpunkte).
- Overlay-Block: für Prognosezeiten das Bracket aus `timelineSteps` bestimmen (vorheriger/nächster Stundenschritt) statt aus `bracketFramesForMs(frames, …)`; `progress` als Anteil innerhalb dieses Stundenintervalls berechnen und die zugehörigen Frames per bestehender Nearest-Suche als `frame`/`nextFrame` an `CrossfadePrecipOverlay` bzw. `PrecipOverlay` geben.
- Messzeiten (`source === "radar"`) behalten den bisherigen Pfad ohne Fade.
- `fadeWeight` (0.55, Perlin-Smoothstep) und `QSTEPS` unverändert; Prefetch/Cache unverändert.
- Keine Ingest-/Backend-Änderung (der 15-min-Abruf kann bleiben, er dient nur der PNG-Rasterung).

## Validierung

- Preview: Play vom Prognosestart bis in den späten Horizont — überall gleiche, weiche Stundenübergänge, keine Wiederholungsschritte.
- Scrubben über die Grenze bei ~24/33 h: identisches Verhalten davor und danach.
