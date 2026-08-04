# Farbpunkte in den Niederschlagsflächen: Ursache und Behebung

## Was du siehst
In gleichmässigen Flächen (z. B. gelb) sitzen einzelne kleine Punkte der Nachbarfarbe (grün). Das ist kein echtes Niederschlagssignal, sondern ein Darstellungsartefakt der Prognose-Ebene.

## Ursache (verifiziert im Code)
1. Die Prognosebilder werden als PNG mit genau 7 Farbstufen erzeugt (`scripts/ingest_openmeteo.py`). Beim Einlesen im Browser wird jede Farbe wieder auf **einen** festen Zahlenwert zurückgeführt (Nearest-Color-Lookup in `radar-map.tsx`). Das Feld enthält danach nur noch Stufenwerte wie 2.0 oder 5.0 — keine Zwischenwerte.
2. Dieses Stufenfeld wird anschliessend mit einem 3×3-Mittelwertfilter geglättet (`ensureSmooth`) und bilinear auf die Bildschirmpixel abgetastet.
3. Direkt an einer Farbgrenze liegt der gemittelte Wert dann knapp unter der Schwelle (z. B. 4,95 statt 5,0). Einzelne Pixel im Inneren einer Fläche kippen dadurch in die nächsttiefere Farbstufe — genau die kleinen Punkte im Bild. Der zusätzliche `contrast(1.1)`-Filter macht sie noch auffälliger.

Kurz: Glättung eines bereits in Stufen quantisierten Feldes, danach erneutes Einfärben mit harten Schwellen.

## Behebung
- Statt über den mm/h-Stufenwert wird über den **Bandindex** interpoliert: Farbe → Bandindex (0…6), Glättung und bilineare Abtastung auf dem Indexfeld, Einfärbung über `Math.round(index)`.
  Dadurch bleiben die Bandkanten weich, aber innerhalb einer Fläche kann kein Pixel mehr in ein Nachbarband kippen.
- Die Farbgrenze wird zusätzlich mit einer kleinen Hysterese (Rundungsschwelle 0,5 ± 0,03) stabilisiert, damit auch beim Crossfade zwischen zwei Stunden kein Punktrauschen entsteht.
- Rückkanal für die Messung (numerisches Feld) bleibt unverändert — dort gibt es keine Quantisierung und damit auch keine Punkte.

## Technische Details
- Datei: `src/components/maps/radar-map.tsx`
  - Decoder: zusätzlich zum `mmh`-Feld ein `band`-Float32Array (Index der getroffenen Skalenstufe) speichern.
  - `ensureSmooth` auf das Bandfeld anwenden; `sampleField` liefert dann einen kontinuierlichen Bandindex.
  - Einfärbung im Crossfade-Overlay über den gerundeten Bandindex statt über `colorFor(v)` mit rekonstruiertem mm/h-Wert.
  - Crossfade mischt weiterhin gewichtet — nun auf dem Bandindex, wodurch die Farbdichte konstant bleibt.
- Keine Änderung an Ingest-Skripten, Zeitraster, Kadenz oder Legende nötig.
