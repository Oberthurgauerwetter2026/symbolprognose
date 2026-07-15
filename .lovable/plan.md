## Diagnose

- Die Radar-Messung ist frisch und sichtbar: `radar/frames.json` ist aktuell und enthält Mess-Frames.
- Die Prognose fehlt weiterhin, weil `radar/forecast-frames.json` im Cache **404** liefert.
- Der Open-Meteo-Cache ist noch alt (`version: oberthurgau-openmeteo-cache-v4...`, `generatedAt: 14:29Z`) und wurde seit der neuen PNG-Prognose-Logik nicht erfolgreich neu geschrieben.
- Die Open-Meteo-Trigger kommen aktuell als **429/throttled** zurück; dadurch startet bzw. vollendet der Ingest nicht zuverlässig genug, um das Forecast-Manifest zu erzeugen.

## Plan

### 1. Open-Meteo-Dispatch reparieren
- Die Throttle-Logik so ändern, dass fehlgeschlagene oder alte Runs den Forecast nicht dauerhaft blockieren.
- `429`-Antworten mit aussagekräftigem Grund im Endpoint zurückgeben (`active-run`, `recent-run`, `interval`) und im Cron-Worker-Status sichtbar machen.
- Recent-run-Guard nur für erfolgreiche/aktive Runs anwenden, nicht für fehlgeschlagene Runs, die bereits keinen Forecast erzeugt haben.

### 2. Forecast-Erzeugung robuster machen
- `scripts/ingest_openmeteo.py` so anpassen, dass `radar/forecast-frames.json` immer geschrieben wird, auch wenn einzelne PNG-Batches teilweise ausfallen.
- Falls die dichte ICON-CH1-Abfrage scheitert, aus dem vorhandenen Sparse-Cache ein temporäres Forecast-Manifest erzeugen, damit wenigstens eine sichtbare Prognose vorhanden ist statt gar keiner.
- Den Referenz-Zeitpunkt nicht nur aus `phase1_dense[0]` lesen, weil ein Platzhalter im ersten Batch aktuell dazu führen kann, dass komplett keine PNGs erzeugt werden.

### 3. Debug-Endpoint auf Preview/Live angleichen
- Sicherstellen, dass `/api/public/debug/r2-cache` immer ein `forecast`-Feld ausgibt.
- Zusätzlich anzeigen: `forecast.error`, `frameCount`, `latestT`, Open-Meteo-Version und Alter des Forecast-Caches.

### 4. Client-Fallback verbessern
- Wenn kein Forecast-Manifest existiert, nicht nur einen Hinweis zeigen, sondern optional die vorhandenen Modellwerte aus `openmeteo/forecast.json` als Canvas-Prognose verwenden.
- Sobald PNG-Prognosen verfügbar sind, automatisch wieder auf die hochauflösenden Forecast-PNGs wechseln.

### 5. Verifikation
- Debug-Endpoint prüfen: `forecast.frameCount > 0` und `latestT > now`.
- Radar-Serverfunktion prüfen: Frames mit `t > now` müssen zurückkommen.
- `/karten/radar` visuell prüfen: Timeline muss Messung + Prognose enthalten.