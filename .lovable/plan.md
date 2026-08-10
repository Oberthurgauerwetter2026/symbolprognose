# Radar Ingest: Abbruch mit exit code 1 verhindern

## Ausgangslage

Der Workflow-Schritt „Run ingest“ endete mit `Process completed with exit code 1`.
Der Ablauf in `scripts/ingest_radar.py` ist bereits weitgehend abgesichert: STAC-Fehler,
Einzel-Frame-Fehler, Inventur und `write_region_max` werden abgefangen und führen nur zu
einer Log-Warnung.

Nicht abgesichert sind die letzten Schritte:

- `cleanup(s3, ...)` – Löschen alter Objekte
- `write_manifest(s3)` – `PutObject` von `radar/frames.json`

Ein transienter Cloudflare-R2-Fehler (in diesem Projekt schon aufgetreten:
`InternalError ... reached max retries`) an diesen Stellen bricht den ganzen Run ab,
obwohl die Frames bereits erfolgreich hochgeladen wurden. Der genaue Fehlertext des
letzten Runs liegt nicht vor, deshalb wird gezielt diese Fehlerklasse robust gemacht.

## Was geändert wird

1. **Retry für R2-Schreibvorgänge**: `write_manifest` und `cleanup` bekommen je bis zu
   3 Versuche mit ansteigender Wartezeit (2s, 5s). Erst danach gilt der Schritt als
   fehlgeschlagen.
2. **Weicher Fehler statt Abbruch**: Schlägt `cleanup` endgültig fehl, wird nur geloggt –
   alte Dateien werden beim nächsten Lauf entfernt. Schlägt `write_manifest` endgültig
   fehl, wird dies deutlich geloggt und der Run mit Exit-Code 1 beendet (nur dann, weil
   ohne Manifest die Karte keine neuen Frames sieht).
3. **Klares Log-Fazit**: Am Ende eine Zeile mit Status pro Teilschritt
   (`frames`, `cleanup`, `manifest`, `region-max`), damit ein künftiger Fehlschlag im
   GitHub-Log sofort zuzuordnen ist – ohne Rätselraten über „exit code 1“.
4. Keine Änderung an Zeitplan, Schwellen, Darstellung oder anderen Workflows.

## Technische Details

- Datei: `scripts/ingest_radar.py`
- Neuer kleiner Helper `retry_r2(label, fn, attempts=3)` neben dem bestehenden
  HTTP-Retry-Helper; nutzt dieselbe Backoff-Logik.
- `main()` sammelt Teil-Status in einem Dict und gibt am Ende eine Zusammenfassung aus.
- Rückgabewert bleibt 0, ausser das Manifest konnte nicht geschrieben werden.
