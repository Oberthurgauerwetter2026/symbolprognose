# Schwellen mit Bezugsdauer sichtbar machen

Aktuell zeigt das Warn-Tool nur **eine** Schwellenzeile – die, die am besten zur eingestellten Gültigkeitsdauer passt. Bei „ab 20 mm" ist damit nicht erkennbar, dass sich das auf **12 Stunden** bezieht. Das wird ergänzt, und die Bezugsdauern werden für alle sechs Gefahrenarten vervollständigt.

## Recherchierte Bezugsdauern (MeteoSchweiz, Alpennordseite, unter 800 m)

| Gefahr | Bezugsdauer(n) | Stufe 1 / 2 / 3 |
|---|---|---|
| Regen | 12 h | 20 / 35 / 60 mm |
| Regen | 24 h | 30 / 50 / 80 mm |
| Regen | 48 h | 50 / 80 / 110 mm |
| Regen | 72 h | 60 / 100 / 130 mm |
| Gewitterregen | 1 h (Momentanintensität) | 15 / 30 / 50 mm/h |
| Gewitterböen | Böenspitze, dauerunabhängig | 70 / 90 / 120 km/h |
| Gewitterhagel | Korngrösse, dauerunabhängig | – / 2 / 4 cm |
| Wind | Böenspitze, dauerunabhängig | 70 / 90 / 110 km/h |
| Schnee | 12 h | 5 / 10 / 20 cm |
| Schnee | 24 h | 10 / 15 / 30 cm |
| Schnee | 72 h | 30 / 50 / 70 cm |
| Strassenglätte | qualitativ, Glatteismenge in 6 h + Andauer | unter 2 mm / über 2 mm / mehrere Stunden anhaltend |
| Frost | Nacht-Minimum (5 cm über Boden) | 0 bis −4 °C offiziell; Stufen 2/3 eigene Setzung |

Wichtig für die Anzeige: Böenspitzen und Hagelkorn sind **keine** Summen über einen Zeitraum, sondern Spitzenwerte. Regen und Schnee sind Summen und brauchen zwingend die Dauerangabe.

## Umsetzung

**`src/lib/warnings-config.ts`**
- Pro Schwellenzeile ein Feld `periodLabel` ergänzen: „in 12 Std.", „in 24 Std.", „Böenspitze (Momentanwert)", „Intensität pro Stunde" usw. – damit die Anzeige nicht selbst aus `hours` Text bauen muss.
- Regen: zusätzliche Kurzzeit-Zeile 1 h mit 15 / 30 / 50 mm (aus den Gewitterkriterien abgeleitet, als eigene Setzung markiert), damit auch kurze Warnfenster eine passende Zeile haben.
- Gewitter: zweite Zeile für Regenintensität pro Stunde (15/30/50) neben den Böenspitzen; Hagelkriterien bleiben Textnotiz.
- Glätte und Frost: `periodLabel` in den Notizen mitführen (Bezugszeitraum benennen, weiterhin keine numerische Empfehlung).

**`src/routes/admin-warnungen.tsx` – Schwellen-Block**
- Statt nur einer Zeile alle Bezugsdauern der Gefahrenart als kompakte Tabelle anzeigen: Spalte Bezugsdauer, dann Stufe 1/2/3 mit Farbe und Wert.
- Die zur eingestellten Gültigkeit passende Zeile wird hervorgehoben (Rahmen + Label „passt zur Gültigkeit: X Std.").
- Die Stufenempfehlung bezieht sich weiterhin nur auf die hervorgehobene Zeile; darunter ein Satz, welcher Zeitraum dafür herangezogen wurde.
- Bei dauerunabhängigen Gefahren (Wind, Gewitterböen) erscheint statt der Dauerspalte „Böenspitze".

Keine Änderungen an Warntexten, Push-Meldungen, Karte oder der Radar-Autowarnung.
