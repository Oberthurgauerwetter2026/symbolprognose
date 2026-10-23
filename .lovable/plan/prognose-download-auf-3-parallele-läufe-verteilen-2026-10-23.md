# Prognose-Download auf 3 parallele Läufe verteilen

## Befund
- Seit der Erweiterung auf Basel–Ulm–Tirol fragt ein Lauf 6336 dichte Punkte ab, dazu 2 × 792 grobe Punkte. Das macht rund 7900 Abfragen von einer einzigen Runner-Adresse.
- Open-Meteo erlaubt pro Adresse 5000 Abfragen pro Stunde. Nach etwa zwei Dritteln kommen deshalb Sperren (429). Weil höchstens 1 % fehlen darf, wird nichts veröffentlicht.
- Darum bleibt die alte Prognose stehen: kleiner Ausschnitt, glatte Ränder, keine Körnung. Beide Beobachtungen haben dieselbe Ursache.
- Noch offen: Das Ende eines Laufs mit dem Abbruchgrund habe ich nicht gesehen. Schritt 1 prüft das im ersten neuen Lauf.

## Was sich ändert
- Der Download wird auf 3 Rechner aufgeteilt, die gleichzeitig laufen. Jeder holt ein Drittel der dichten Punkte, also rund 2100 Abfragen. So bleibt jeder deutlich unter dem Limit.
- Ein vierter Schritt setzt die drei Teile zusammen, holt die groben Daten und erzeugt die Prognosebilder wie bisher. Die Auflösung von etwa 2–3 km bleibt erhalten.
- Fehlt ein Teil, wird nichts veröffentlicht. Die letzte gute Prognose bleibt dann stehen, und es entsteht nie eine halb leere Karte.
- Ein Lauf dauert neu etwa 20 Minuten statt bisher 50–90 Minuten.

## Technische Details
- `scripts/ingest_openmeteo.py`:
  - Neuer Modus `SHARD_INDEX`/`SHARD_COUNT`. Er holt nur `dense_pts[i::n]` oder einen zusammenhängenden Block und schreibt `phase1_shard_<i>.json` lokal. Kein R2-Upload.
  - Neuer Modus `MERGE_SHARDS_DIR`. Er lädt alle Shards, prüft Vollständigkeit und Reihenfolge (Punktanzahl, Koordinaten) und setzt `phase1_dense` zusammen. Danach läuft die bestehende Pipeline: Rasterung, phase2, phaseC, Manifest, Cleanup. Ein fehlender Shard bricht vor der Veröffentlichung ab.
  - Am Ende der Abfragen eine Zusammenfassung ausgeben: Anzahl 429, Timeouts, fehlende Batches. So ist der Abbruchgrund im Log sofort sichtbar.
- `.github/workflows/openmeteo-ingest.yml`:
  - Job `fetch` mit `strategy.matrix.shard: [0,1,2]`, `fail-fast: true`, `timeout-minutes: 40`, Upload als Artifact `phase1-shard-N`.
  - Job `publish` mit `needs: fetch`. Er lädt die Artifacts herunter und startet den Merge-Modus mit den R2-Secrets.
  - Die Sperre gegen gleichzeitige Läufe (`concurrency`) bleibt auf Workflow-Ebene.
- `scripts/test_forecast_publication.py`: Test ergänzen, dass Shard-Aufteilung plus Merge exakt die ursprüngliche Punktreihenfolge ergibt. Ein zweiter Test prüft, dass ein fehlender Shard nichts veröffentlicht.
- Risiko: GitHub teilt parallelen Jobs meist verschiedene Adressen zu, garantiert ist das aber nicht. Teilen sich zwei Jobs eine Adresse, sind es zusammen rund 4200 Abfragen und damit weiterhin unter 5000.
