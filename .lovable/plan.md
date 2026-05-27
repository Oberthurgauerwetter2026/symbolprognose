## Klarstellung

Die **Daten-Bbox** (Messung + Prognose) bleibt wie zuletzt verdoppelt — Niederschlag soll ja auch ausserhalb der Region sichtbar sein. Was nicht passieren soll: dass die **Karte selbst** nach Süden verschoben/erweitert wird.

## Änderung — nur `src/components/maps/radar-map.tsx`

`maxBoundsExt` nach Norden öffnen, südliche Grenze auf den alten Wert zurück:

- alt (gerade gesetzt): `[[46.97, 8.27], [48.18, 10.42]]`
- neu: `[[47.25, 8.27], [48.18, 10.42]]`

Damit:
- Im Süden kein zusätzlicher Pan/Sichtbereich (Karte „rutscht" nicht nach Süden).
- Im Norden, Osten und Westen ist die verdoppelte Daten-Bbox vollständig erreichbar — Niederschlag jenseits der Region wird angezeigt.
- `regionBounds` (Default-Startausschnitt Oberthurgau) bleibt unverändert.

## Nicht angefasst

- `BBOX` / `GRID_LAT` / `GRID_LON` in `src/lib/radar.functions.ts` — bleiben verdoppelt.
- `scripts/ingest_openmeteo.py` und `scripts/ingest_radar.py` — bleiben verdoppelt.
- Farben, Tropfen-Icons, Timeline.
