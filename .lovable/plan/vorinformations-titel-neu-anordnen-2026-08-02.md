# Vorinformations-Titel neu anordnen

## Ausgangslage

Im Infopanel der Warnkarte steht bei einer Vorinformation aktuell zuerst der Warntitel („Gewitterwarnung (Stufe 1)“) und darunter ein kleiner Chip „Vorinformation“. Die Kennzeichnung erscheint damit erst nach dem Titel und wirkt nachgestellt.

## Neu

- Zeile 1: kleines, klar erkennbares Label **„Vorinformation“** (Stufenfarbe als Rahmen/Text, kompakt).
- Zeile 2: der Warntitel, z. B. „Gewitterwarnung (Stufe 1)“, einzeilig mit Kürzung bei Platzmangel.
- Echte Warnungen bleiben unverändert einzeilig (nur Titel, vollflächige Stufenfarbe).
- Wenn der erfasste Titel schon mit „Vorinformation“ beginnt, wird das Label nicht doppelt gezeigt.
- Hintergrund, Icon, Rahmen und Farben bleiben wie heute.

## Technisch

- Datei: `src/components/maps/warn-map.tsx`, Header-Block der Warnliste (ca. Zeile 704–731).
- Reihenfolge der beiden `<span>`-Elemente im `min-w-0 flex-1`-Container tauschen: Label zuerst, Titel danach.
- Label-Abstand von `mt-1` auf `mb-1` umstellen.
- Keine Änderungen an Datenbank, Server-Funktionen, Push oder Karte.
