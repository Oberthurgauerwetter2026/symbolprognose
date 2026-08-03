# Prognose-Niederschlag organischer darstellen

## Befund (im Code geprüft)

In `scripts/ingest_openmeteo.py` wird das Prognosefeld aktuell aus dem Dense-Grid (48 × 56 Punkte, ca. 3 km) per **Nearest-Neighbour** auf das Messraster 240 × 144 vergrössert (`_upsample_nearest`, Zeile 283–298, Aufruf Zeile 314). Ein Modellpunkt wird dadurch zu einem Block von ca. 5 × 3 Bildpixeln aufgeblasen: die Flächen wirken treppenförmig/verzerrt und die Bandkanten laufen in groben Rechtecken statt in organischen Konturen wie beim Radarbild.

Die Messung erzeugt ihre Blockstruktur zwar auch per Nearest-Neighbour, dort ist die Quelle aber schon ~1 km fein — jeder Block ist ein Pixel. Gleiches Verfahren bei 3-km-Quelle sieht deshalb nicht gleich, sondern grob aus.

## Änderung (nur `scripts/ingest_openmeteo.py`)

1. **Glatte Neurasterung statt Nearest**: Neue Funktion `_upsample_smooth` (bilinear bzw. Catmull-Rom-artig, NumPy-only) ersetzt `_upsample_nearest` beim Rendern der Prognose-PNGs. Interpoliert werden die *Werte*, nicht die Farben.
2. **Bandkanten bleiben hart**: Die Farbzuordnung über `PRECIP_SCALE` bleibt unverändert bandweise mit harten Schwellen. Ergebnis: Kanten sind so scharf wie in der Messung, verlaufen aber als organische, gekrümmte Konturen entlang des interpolierten Feldes statt als Rechteckblöcke.
3. **Bereinigung anpassen**: `clean_precip_field` läuft weiter auf dem 240 × 144-Raster; Mindestflächen werden von 9 px auf einen Wert angehoben, der der Modellauflösung entspricht (ca. 12–16 px), damit durch die Interpolation keine dünnen Ein-Pixel-Säume zwischen Bändern stehen bleiben.
4. Zielraster (240 × 144), BBox, Georeferenzierung, Farbskala, Deckkraft, Timeline/Filmstrip und das Optical-Flow-Morphing im Frontend bleiben unverändert.

## Wirkung und Grenzen

Die Prognoseflächen bekommen weiche, natürliche Umrisse mit harten Farbübergängen — optisch nahe an der Messung. Physikalisch bleibt die Prognose ein ~3-km-Modellfeld: sie zeigt keine echten Radarzellen-Details, aber keine künstlichen Blöcke mehr.

Falls die Struktur danach noch zu grob ist, wäre der nächste Schritt eine feinere Datenabfrage (Dense-Grid von 48 × 56 auf ca. 60 × 72 erhöhen). Das kostet deutlich mehr Open-Meteo-Requests pro Lauf und ist bewusst nicht Teil dieser Änderung.

Die neue Optik erscheint mit dem nächsten Ingest-Lauf; bestehende Prognose-PNGs werden dabei ersetzt.
