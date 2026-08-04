# Kartenausschnitt auf das Datenfenster begrenzen

Ziel: Die harte Kante des Niederschlagsfelds liegt künftig immer knapp aussen am Kartenrand und fällt nicht mehr als „abgeschnitten" auf. Keine Ingest-Änderung, keine neuen Daten.

## Was geändert wird

1. **Radar** (`src/components/maps/radar-map.tsx`): `maxBoundsExt` von `46.80–48.35 / 8.10–10.60` exakt auf das Datenfenster `46.85–48.30 / 8.15–10.55` setzen. `maxBoundsViscosity` bleibt `1.0`.
2. **Wind** (`src/components/maps/wind-map.tsx`): identisches `maxBoundsExt` auf dieselben Werte setzen.
3. **Niederschlagssummen** (`src/components/maps/precip-accum-map.tsx`): `MAP_BOUNDS` (aktuell `47.25–47.90 / 8.65–9.95`) bleibt unverändert, da es bereits innerhalb des Datenfensters liegt — hier gibt es keine sichtbare Datenkante.
4. **Mindestzoom** in Radar und Wind (aktuell `minZoom=8`) auf `9` heben, damit der kleinste erlaubte Zoom das Datenfenster füllt statt es zu unterschreiten. Standardzoom `9.0` bleibt.

## Prüfung

Radar- und Windkarte in Desktop-Breite und im Handy-Hochformat aufziehen und maximal herauszoomen: Es darf an keiner Seite eine leere Fläche neben dem Overlay sichtbar sein.

## Umfang

Reine Frontend-Änderung (zwei Kartenkomponenten, Grenzen und Mindestzoom). Skalen, Frames, Filmstrip und Datenpipeline bleiben unangetastet.
