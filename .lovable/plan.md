# Satellit: Quellen-Badge entfernen, Attribution erweitern

Der schwarze Quellen-Banner unten links über der Karte ist redundant — die Leaflet-Attribution unten rechts (`© EUMETSAT`) zeigt die Quelle bereits. Nutzer wünscht: Banner weg, dafür "Oberthurgauer Wetter" in der bestehenden Attribution unten rechts ergänzen.

## Änderung in `src/components/maps/satellite-map.tsx`

1. **Zeilen 623–626 entfernen** — den `<div>`-Block mit dem schwarzen Quellen-Badge (`bottom-20 left-2 … {source}`).
2. **Zeile 110–111**, WMS-`attribution` ergänzen:
   - Vorher: `© <a href="…eumetsat.int…">EUMETSAT</a>`
   - Nachher: `Oberthurgauer Wetter · © <a href="…eumetsat.int…">EUMETSAT</a>`

Die Variable `source` wird auf der Karte nicht mehr angezeigt, bleibt aber in den Daten und kann an anderer Stelle (z. B. Header/Info) weiter genutzt werden — keine Entfernung nötig.

## Verifikation

`/karten/satellit` öffnen: kein schwarzer Banner mehr unten links; unten rechts steht "Oberthurgauer Wetter · © EUMETSAT".
