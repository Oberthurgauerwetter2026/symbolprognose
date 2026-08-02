# Niederschlagsradar: Filmstrip rastet sauber auf Frames

## Befund (geprüft an den Live-Daten)

- Messung: `radar/frames.json` liefert exakt 5-Minuten-Frames (…21:05, 21:10, 21:15, 21:20 Z).
- Prognose: `radar/forecast-frames.json` liefert 15-Minuten-Frames (21:30, 21:45, 22:00 …) — also keinen Stundentakt.
- Das Raster im Code (`timelineSteps`) ist bereits 5 min / Frame-Kadenz. Der Minuteneindruck entsteht in der Anzeige: beim Ziehen und beim Abspielen folgt die Bubble-Zeit und der Strip der frei laufenden Zeit (`dragMs` / interpolierte Playback-Zeit), nicht dem eingerasteten Schritt. Deshalb liest man 21:07, 21:08, 21:09 … obwohl gerendert nur zwischen Frames gemorpht wird.

## Änderung

1. Filmstrip rastet sichtbar: Bubble-Label und die Strip-Position folgen dem eingerasteten Schritt (nächster Frame), nicht der Rohposition des Fingers. Beim Ziehen springt die Zeit also in 5-min-Schritten (Messung) bzw. 15-min-Schritten (Prognose).
2. Auch beim Abspielen zeigt die Bubble die Frame-Zeit des aktuellen Schritts; das weiche Morphing der Karte zwischen zwei Prognose-Frames bleibt unverändert erhalten.
3. Prognoseschritte bleiben auf den echten Frame-Zeiten (heute 15 min). Sollte der Ingest später gröber liefern, passt sich das Raster automatisch an.

## Optional (bitte sagen, falls gewünscht)

Wenn die Prognose bewusst nur im Stundentakt scrollbar sein soll, kann das Raster im Prognoseteil auf volle Stunden reduziert werden — die Zwischen-Frames dienen dann nur noch der Animation.

## Technische Details

- `src/components/maps/filmstrip-timeline.tsx`: `motionMs` beim Dragging auf `times[dragIdx]` snappen (statt `dragMs`); `visualMs` nur noch für die Karten-Interpolation nutzen, nicht für Bubble/Transform.
- `src/components/maps/radar-map.tsx`: `visualMs`-Übergabe an den Filmstrip entfällt bzw. wird auf den Schrittwert gesetzt; `renderMs` (Karten-Rendering) bleibt kontinuierlich, damit das Optical-Flow-Morphing weiterhin flüssig ist.
- Keine Backend-/Ingest-Änderung nötig.
