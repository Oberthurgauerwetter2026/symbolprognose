# Radar-Prognose: abgeschnittene Felder dauerhaft verhindern

## Befund (verifiziert)

Das aktuell ausgelieferte Prognosebild (`radar/forecast/20260817T1600.png`, Manifest `radar/forecast-frames.json`) hat eine messerscharfe, waagrechte Kante: Ab Bildzeile 61 (≈ 47.68° N) endet das Niederschlagsband über die volle Bildbreite, weiter nördlich liegt ein separates Feld. Meteorologisch unmöglich — es ist ein Datenloch.

Ursache im Ingest (`scripts/ingest_openmeteo.py`):

- Das dichte Prognosegitter (120 × 140 Punkte) wird in Batches von 15 Punkten bei Open-Meteo geholt. Die Punktliste ist zeilenweise (row-major) sortiert, ein Batch entspricht also einem Stück einer Breitengrad-Zeile.
- Scheitert ein Batch, füllt `chunk_fetch` ihn mit leeren Platzhaltern (`{}`). In der Rasterung werden diese Punkte als **0 mm/h** gezeichnet.
- Erlaubt sind aktuell bis zu 20 % ausgefallene Batches (`PHASE1_DENSE_MAX_FAIL_PCT=20`). Fallen mehrere aufeinanderfolgende Batches aus, entsteht genau so ein voll­breiter, gerade abgeschnittener Streifen — und er wird publiziert, weil die alten PNGs vorher gelöscht werden.

## Ziel

Eine unvollständige Prognose wird nie mehr veröffentlicht. Entweder ein lückenloses, glattes Feld — oder die vorherige (noch gültige) Prognose bleibt stehen.

## Umsetzung

1. **Ausfälle nachholen statt tolerieren** (`chunk_fetch`)
   - Zweiter, sequentieller Nachlauf für alle gescheiterten Batches mit längeren Wartezeiten, bevor Platzhalter akzeptiert werden.
   - Platzhalter klar als „kein Wert“ markieren (nicht als 0), damit die Rasterung sie unterscheiden kann.

2. **Lückenprüfung vor dem Publizieren** (`rasterize_forecast_pngs`)
   - Fehlende Punkte pro Gitter zählen. Kleine, isolierte Löcher werden aus den Nachbarwerten gefüllt (bestehende Catmull-Rom-/Glättungslogik nutzen).
   - Sobald eine ganze Gitterzeile oder -spalte fehlt, oder die Fehlquote über eine strenge Schwelle (Standard 1 %) steigt: Rasterung abbrechen, klar geloggt, **kein** Manifest-Update.

3. **Alte Prognose nie vorschnell löschen**
   - `_purge_forecast_pngs` erst nach erfolgreicher, geprüfter Rasterung ausführen (heute läuft es davor). So bleiben bei einem Abbruch die letzten guten PNGs plus Manifest aktiv.
   - Toleranz `PHASE1_DENSE_MAX_FAIL_PCT` von 20 auf 1 senken; bei Überschreitung greift der bestehende Cache-Fallback.

4. **Manifest-Kennzeichnung + Client-Absicherung**
   - Im Manifest pro Lauf eine `coverage`-Kennzahl mitschreiben.
   - `src/lib/radar.functions.ts`: Frames aus einem Lauf mit unzureichender Coverage nicht ausliefern (analog zur bestehenden Regel „Prognoseframes ohne PNG kommen nicht in die Liste“).

5. **Sichtbarkeit im Admin**
   - In der Pipeline-Diagnose die Coverage des letzten Prognoselaufs anzeigen, damit ein solcher Ausfall sofort erkennbar ist statt erst in der Karte.

6. **Dauerhaft festhalten**
   - Bestehende Merkregel „Radar-Prognose nie blockig" um „nie abgeschnitten / nie mit Nullflächen aus fehlgeschlagenen Batches" erweitern.

## Technische Details

- Betroffene Dateien: `scripts/ingest_openmeteo.py` (chunk_fetch, rasterize_forecast_pngs, rasterize_forecast_hourly_pngs, write_forecast_manifest, main-Reihenfolge), `.github/workflows/openmeteo-ingest.yml` (Schwellenwert-Env), `src/lib/radar.functions.ts` (Coverage-Gate), `src/routes/admin.tsx` (Diagnose-Anzeige).
- Keine Änderung an Farbskala, Interpolation, Zeitraster oder Kartendarstellung.

## Prüfung

- Nach dem nächsten Ingest-Lauf die publizierten PNGs herunterladen und prüfen, dass keine voll­breite Nullzeile existiert (automatisierbare Zeilen-Analyse wie im Befund).
- Künstlich erzwungener Batch-Ausfall: Lauf bricht die Rasterung ab, altes Manifest bleibt unverändert.
