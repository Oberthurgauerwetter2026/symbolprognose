# Ortslabels auf Radar-/Wind-/Niederschlagssummen-Karten reduzieren

## Ziel
Dicht beieinander liegende, doppelte Ortslabels entfernen und die Auswahl im Standardfokus auf die wichtigsten Städte um den Oberthurgau/Bodensee reduzieren. Im Standardfokus sollen im Oberthurgau nur **Bischofszell** und **Romanshorn** als Ortslabels sichtbar sein; alle weiteren Oberthurgau-Ortschaften erscheinen beim Hereinzoomen weiterhin automatisch.

## Geplante Änderungen

### 1. Referenzstädte (`src/data/reference-cities.ts`)
Bei Paaren unter ca. 12 km Abstand wird die weniger relevante Stadt für den Kartenfokus entfernt:

| Entfernt | Grund / Behalten bleibt |
|---|---|
| Konstanz | Kreuzlingen (Schweizer Seite) liegt direkt daneben |
| Gossau | Im St. Gallen-Cluster redundant |
| Herisau | Im St. Gallen-Cluster redundant |
| Trogen | Im St. Gallen-Cluster redundant |
| Appenzell | Im St. Gallen-Cluster redundant |
| Heiden | St. Gallen liegt daneben |
| Uzwil | Wil liegt daneben |
| Flawil | Wil / Uzwil / Gossau / Herisau liegen daneben |
| Dornbirn | Bregenz liegt daneben |
| Wattwil | Wil liegt daneben |

**Verbleibende Referenzstädte:**
Zürich, St. Gallen, Winterthur, Kreuzlingen, Bregenz, Schaffhausen, Friedrichshafen, Frauenfeld, Wil, Ravensburg, Rapperswil-Jona.

### 2. Oberthurgau-Ortschaften (`src/data/oberthurgau-places.ts`)
Damit Bischofszell und Romanshorn bereits im Standardfokus (Zoom 9) sichtbar sind:

- `Bischofszell.minZoom` auf `9` setzen
- `Romanshorn.minZoom` auf `9` setzen

Alle anderen Oberthurgau-Orte behalten ihre aktuellen Zoom-Schwellen (10.5 bis 14) und werden erst beim Hereinzoomen eingeblendet.

## Keine weiteren Änderungen
Die Marker-Komponente `src/components/maps/city-markers.tsx` und die Kartenintegration bleiben unverändert. Die Änderungen beschränken sich auf die beiden Datenlisten.

## Validierung
- `bun run build` ausführen
- Screenshots der Radar-, Wind- und Niederschlagssummen-Karte im Standardfokus prüfen, ob die Label-Verteilung ausgewogen ist
