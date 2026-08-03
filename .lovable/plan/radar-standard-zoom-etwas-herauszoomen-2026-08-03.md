# Radar: Standard-Zoom etwas herauszoomen

## Ziel
Der Niederschlagsradar soll beim ersten Laden etwas weiter herausgezoomt sein, damit der Nutzer mehr Kontext (z. B. angrenzende Regionen) sieht.

## Aktueller Zustand
- `src/components/maps/radar-map.tsx` öffnet mit `center={[47.575, 9.35]}` und `zoom={9.5}`.
- Vergleichbare Karten (Wind, Niederschlagssummen) nutzen ebenfalls `zoom={9.5}`.

## Geplante Änderung
- In `src/components/maps/radar-map.tsx` den Standard-`zoom` von `9.5` auf `9.0` (oder falls visuell noch zu nah, auf `8.75`) reduzieren.
- Optional prüfen, ob das Zentrum `[47.575, 9.35]` bei geringerem Zoom noch zentriert bleibt; bei Bedarf minimal korrigieren.

## Technische Details
- Eine einzelne Zeilenänderung im `MapContainer`-Props-Block ab Zeile 1858.
- Keine Änderung an Logik, Datensources, Embed-Routen oder anderen Karten.
