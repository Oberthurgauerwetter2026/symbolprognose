## Befund

Der gepostete `Run ingest`-Output ist weiterhin die alte Ausgabe. In der aktuellen Datei müsste vor `== precip ... ==` zwingend stehen:

```text
radar ingest v3-diagnostics-fallback lookback=12h retention=24h
```

Und innerhalb jedes Produkts müssten Zeilen wie `lookback=12h`, `STAC GET ...`, `asset ts range ...` erscheinen. Dass sie fehlen, spricht stark dafür, dass GitHub Actions noch nicht den aktuellen Lovable-Stand ausführt.

## Plan

1. **Workflow mit Fail-Fast-Versioncheck absichern**
   - Vor dem eigentlichen Ingest prüfen, ob `scripts/ingest_radar.py` die erwartete `RADAR_INGEST_VERSION` enthält.
   - Wenn nicht, bricht der Workflow mit klarer Fehlermeldung ab, statt still den alten Code auszuführen.

2. **Ingest-Ausgabe unverwechselbar machen**
   - Den Startbanner noch auffälliger machen und mit Commit-/Ref-Kontext aus der Action kombinieren.
   - Den Python-Aufruf mit ungepufferter Ausgabe ausführen, damit Diagnosezeilen sicher im Log erscheinen.

3. **Leeres Manifest verhindern**
   - `write_manifest` so härten, dass ein Run ohne Frames nicht mehr `radar/frames.json` auf `0 frames` überschreibt, sofern bereits ein bestehendes Manifest vorhanden ist.
   - Dadurch bleibt die Radar-Karte sichtbar, selbst wenn ein einzelner Ingest keine neuen Daten findet.

4. **Fallback klarer machen**
   - Wenn nach `since` keine Frames übrig bleiben, werden die neuesten parsebaren STAC-Assets verwendet und explizit als Fallback geloggt.
   - Falls gar keine parsebaren Assets gefunden werden, wird das als echter Daten-/Parsing-Fehler sichtbar.

## Erwartetes Ergebnis

Der nächste Action-Run zeigt entweder eindeutig die neue Script-Version und verarbeitet Fallback-Frames, oder er bricht früh mit einer klaren Meldung ab, dass GitHub noch einen alten Commit/Branch ausführt.