## Ziel

Herausfinden, warum `radar/forecast-frames.json` in R2 nicht erzeugt wird, und gezielt fixen.

## Voraussetzung

Der GitHub-Connector ist im Workspace aktuell **nicht verbunden** — ich kann die Actions-Logs nicht direkt lesen. Zwei Wege:

- **A (empfohlen)**: GitHub-Connector über die Lovable-Connector-Einstellungen verbinden. Dann kann ich `owner/repo` per REST-API abfragen (`actions/workflows/openmeteo-ingest.yml/runs`, `jobs`, `logs`) und den echten Fehler des letzten Runs sehen.
- **B**: Du gibst mir den Fehler-Text des letzten fehlgeschlagenen `openmeteo-ingest`-Runs (die letzten ~50 Zeilen des Job-Logs, insbesondere um `phase1_dense` / `rasterize_forecast_pngs` / `write_forecast_manifest`).

## Vorgehen nach Log-Zugriff

1. **Letzten Run inspizieren**
   - Status (`success` / `failure`), Dauer, Exit-Code
   - Rate-Limit-Meldungen (`429`, `Minutely API request limit exceeded`)
   - Ob `phase1_dense` ausgefallen ist und ob der Sparse-Fallback in `rasterize_forecast_pngs` gegriffen hat
   - Ob `write_forecast_manifest` überhaupt aufgerufen wurde und wie viele Frames geschrieben wurden

2. **Diagnose je nach Befund**
   - **Dense-Grid scheitert komplett** → `SKIP_PHASE1_DENSE=1` als Workflow-Env, oder `GRID_LAT_DENSE=40 / GRID_LON_DENSE=48` (~3.6 km). Der Sparse-Fallback in `rasterize_forecast_pngs` schreibt dann PNGs aus dem 22×36-Grid.
   - **Rasterizer wirft Exception** → gezielter Fix in `scripts/ingest_openmeteo.py`, z.B. NaN-Handling oder fehlende Achsen bei Sparse-Input.
   - **Manifest-Upload scheitert** → R2-Credentials/Key prüfen.
   - **Alte Cache-Version verhindert Ingest** (siehe `oberthurgau-openmeteo-cache-v4-ch1-wind` von 14:29Z) → Version bumpen, damit Retry erzwungen wird.

3. **Deployment-Check**
   - Prüfen, ob `src/routes/api/public/debug/r2-cache.ts` mit dem `forecast`-Feld überhaupt schon deployt ist (aktuell fehlt es in der Response — entweder Build noch nicht durch oder Endpoint gecacht).

4. **Manueller Retrigger**
   - Über GitHub-API `workflow_dispatch` auf `openmeteo-ingest.yml` auslösen und den Run beobachten.

5. **Verifikation**
   - `radar/forecast-frames.json` in R2 vorhanden, `frameCount > 0`
   - `/api/public/debug/r2-cache` zeigt `forecast.futureFrameCount > 0`
   - Karte `/karten/radar` zeigt Timeline über `now` hinaus mit Prognose-Frames

## Nächster Schritt

Bitte GitHub-Connector verbinden **oder** die Log-Ausgabe des letzten `openmeteo-ingest`-Runs hier einfügen. Danach setze ich Schritt 1–5 um.
