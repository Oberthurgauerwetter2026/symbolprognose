# Prognose-Ränder natürlicher statt "wurstig"

## Zuerst prüfen
- Ist schon die neue Prognose auf dem Server, also der grosse Ausschnitt mit Körnung? Wenn dort noch das alte Bild von 14:32 UTC liegt, sieht man die neuen Ränder noch gar nicht. Dann zuerst abklären, ob der GitHub-Lauf mit den 6 Teilen grün durchgelaufen ist.

## Was sich ändert (falls die neuen Bilder schon da sind)
- Die Ränder bekommen eine echte, unregelmässige Struktur wie beim Radar: kleine Ausfransungen, Buchten und einzelne Fetzen am Rand. Glatte Bögen soll es nicht mehr geben.
- Die Struktur wirkt nur am Rand und in schwachem Niederschlag. Kerne und starke Zellen bleiben unverändert, damit keine falschen Intensitäten entstehen.
- Das Muster bleibt ortsfest. So flimmert es beim Abspielen nicht von Bild zu Bild.
- Die Bereinigung entfernt nur noch einzelne Pixel. Kleine Randfetzen bleiben stehen.

## Technische Details
- `scripts/ingest_openmeteo.py`, `_radar_grain`: Statt einem einzigen Rauschmuster kommen zwei Ebenen zum Einsatz, eine feine mit etwa 1–2 px und eine mittlere mit etwa 6–10 px. Das ist deterministisch, mit festem Seed. Die Amplitude wird mit einer Randmaske gewichtet: stark nahe der untersten Schwelle und an Bandgrenzen, gegen null im Kern. Die Gesamtamplitude steigt von 0.14 auf etwa 0.30. Zusätzlich verschiebt sich das Feld an den Rändern leicht, um 1–2 px (Domain-Warp), damit die Kontur aufbricht.
- `clean_precip_field` für die Prognose: `min_area_px` und `hole_area_px` werden auf 2 gesetzt.
- Im Browser keine Glättung der Prognose. Das ist schon umgesetzt und wird nur geprüft.
- Ein synthetischer Test vergleicht die Randlänge pro Fläche: Mit Körnung muss sie deutlich höher sein als ohne. Die Summe des Niederschlags muss dabei innerhalb von ±5 % bleiben. Der Test läuft zusammen mit den bestehenden 12 Tests.
- Sichtbar wird das erst nach dem nächsten erfolgreichen Prognoselauf.
