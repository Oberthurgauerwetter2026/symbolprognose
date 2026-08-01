# Symbolreihenfolge neu anordnen

Neue Reihenfolge überall: Gewitter, Regen, Wind, Schnee, Strassenglätte, Frost.

## Umsetzung
- Die Reihenfolge stammt aus der zentralen Liste `HAZARDS` in `src/lib/warnings-config.ts`. Dort werden die Einträge in die neue Reihenfolge gebracht (Wind vor Schnee).
- Damit übernehmen automatisch alle Oberflächen die neue Sortierung: Legende und Gefahren-Reihen der Warnkarte, Gefahrenauswahl im Admin-Tool, Warn-Banner und Embed-Ansichten.
- Kontrolle: Warnkarte und Admin-Tool nach der Änderung prüfen, dass in allen Auswahl-/Legendenreihen die Folge Gewitter, Regen, Wind, Schnee, Strassenglätte, Frost erscheint.

## Technische Details
- Reine Umsortierung des `HAZARDS`-Arrays; keine IDs, Texte, Farben, Icons oder Datenbankwerte werden geändert.
- Die Reihenfolge des Typs `HazardId` und der Textvorlagen ist funktional irrelevant und bleibt unangetastet.
