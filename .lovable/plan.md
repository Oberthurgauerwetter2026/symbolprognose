# Schweiz-Umriss: Farbe auf Banner-Blau ändern

## Ziel
Im Satellitenbild (Komponente `SwissOutline`) soll der Schweiz-Umriss nicht mehr gelb (`#facc15`), sondern das gleiche Blau wie das App-Banner/Logo (`#2561a1`) verwenden.

## Nachweis aus dem Code
- In `src/components/maps/satellite-map.tsx` steht der aktuelle Umriss auf Zeile 110: `color: "#facc15"`.
- Die Bannerfarbe ist im selben File als `BRAND = "#2561a1"` (Zeile 34) und in `src/components/app-sidebar.tsx` als Hintergrund des App-Logos verwendet (Zeile 29).

## Änderung
In `src/components/maps/satellite-map.tsx` wird die Zeile
```ts
color: "#facc15",
```
geändert in
```ts
color: BRAND,
```
(wobei `BRAND` bereits mit `#2561a1` am Modulanfang definiert ist).

## Keine weiteren Änderungen
- Keine Routing- oder API-Änderungen.
- Keine Datenbank- oder Backend-Änderungen.
- Keine Einflüsse auf Lightning-Layer, Satelliten-Kachelanimation oder Steuerpanel.

## Validierung
Nach der Änderung wird der Umriss in den Regionen „Schweiz & Alpen" und „Europa GeoColour" in der Live-Vorschau visuell auf Blau geprüft.