# Warum das Niederschlagsfeld „abgeschnitten" wirkt

## Ursache (verifiziert im Code)

Radar und Prognose werden nur für ein festes Rechteck berechnet und als Bild gelegt:

- `scripts/ingest_radar.py`: `BBOX_WGS = 8.15–10.55° E / 46.85–48.30° N`, Ausgabe 240 × 144 px (~1 km)
- `scripts/ingest_openmeteo.py`: identisches Fenster für die ICON-CH1-Prognose
- `src/components/maps/radar-map.tsx`: `maxBounds = 8.10–10.60 / 46.80–48.35`, also **grösser als die Daten**, Standardzoom 9

Ausserhalb dieses Rechtecks gibt es keine Werte. Ein Niederschlagsgebiet, das über die Kante hinausreicht, endet darum mit einer perfekt geraden, senkrechten bzw. waagrechten Linie — genau wie im Screenshot. Es ist kein Rendering- oder Farbfehler, sondern die Datenkante des Ausschnitts.

## Vorschlag (empfohlen)

Kante gar nicht mehr sichtbar machen, statt mehr Daten zu holen:

1. `maxBounds` in `radar-map.tsx` (und analog `wind-map.tsx`, `precip-accum-map.tsx`) exakt auf das Datenfenster setzen (`46.85–48.30 / 8.15–10.55`) statt knapp darüber, `maxBoundsViscosity` bleibt 1.0.
2. `minZoom` so wählen, dass der kleinste Zoom das Datenfenster füllt statt es zu unterschreiten (auf Handy-Hochformat geprüft), Standardzoom 9 bleibt.

Damit liegt die harte Kante immer knapp aussen am Kartenrand und fällt optisch nicht mehr als Schnitt auf.

## Alternative (auf Wunsch zusätzlich oder stattdessen)

- **Datenfenster vergrössern**, z. B. auf `7.6–11.1 / 46.5–48.7`. Kosten: grössere PNGs und mehr Prognose-Gitterpunkte pro Ingest-Lauf (Laufzeit + R2-Volumen steigen ca. um Faktor 1.7). Die Kante wandert dann nur weiter nach aussen, verschwindet aber aus dem üblichen Blickfeld.
- **Weiche Randabblendung**: letzte ~4 Pixel des Overlays mit Alpha-Verlauf, so dass die Kante ausfranst statt zu schneiden. Rein kosmetisch, kein Ingest-Eingriff.

## Umfang

Reine Frontend-Änderung für den empfohlenen Weg (Kartengrenzen/Zoom); keine Änderung an Skalen, Daten oder Filmstrip. Ingest-Änderungen nur, falls du die Alternative willst.
