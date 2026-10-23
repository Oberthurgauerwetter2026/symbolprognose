# Radar: Nicht weiter herauszoomen als die Startansicht

## Ziel
Auf der Radarkarte soll man nicht mehr weiter herauszoomen können als die Ansicht beim Öffnen.

## Änderung
- `src/components/maps/radar-map.tsx`: `minZoom` von `7.5` auf `9` setzen (gleich wie der Startzoom `zoom={9}`).
- Hineinzoomen bleibt unverändert möglich. Wind- und Summenkarte bleiben wie sie sind.

## Prüfung
Radarkarte öffnen, mit Minus-Knopf bzw. Zwei-Finger-Geste herauszoomen: Die Ansicht bleibt bei der Startgrösse stehen.
