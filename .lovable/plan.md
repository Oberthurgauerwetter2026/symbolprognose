# Workflow-Versions-Guard nachziehen

Der GitHub-Actions-Workflow `.github/workflows/radar-ingest.yml` prüft per `grep`, dass `scripts/ingest_radar.py` exakt eine bestimmte `RADAR_INGEST_VERSION` enthält, und bricht sonst ab. Aktuell steht dort noch `v19-mch-intensity-boost`, das Script wurde aber auf `v20-odim-time` gebumpt → der Pre-Flight-Check schlägt fehl, bevor irgendetwas gepullt wird.

## Änderung
In `.github/workflows/radar-ingest.yml` Zeile 21:

```yaml
EXPECTED_RADAR_INGEST_VERSION: "v20-odim-time"
```

(statt `"v19-mch-intensity-boost"`).

Keine anderen Anpassungen nötig — der nachgelagerte Migrations-Code im Script erkennt den Versionssprung selbst und purged die alten R2-PNGs beim ersten erfolgreichen Run.

## Geänderte Dateien
- `.github/workflows/radar-ingest.yml`
