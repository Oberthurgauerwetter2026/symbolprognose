Workflow-Guard in `.github/workflows/radar-ingest.yml` Zeile 21 auf die aktuelle Skript-Version aktualisieren:

`EXPECTED_RADAR_INGEST_VERSION: "v22-native-raster"` → `"v23-native-raster-nodata"`

Das Skript wurde im letzten Schritt auf v23 erhöht; der Workflow-Check vergleicht hartkodiert gegen v22 und schlägt deshalb fehl.