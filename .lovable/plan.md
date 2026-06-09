# Open-Meteo Ingest stabiler machen

## Ursache
`scripts/ingest_openmeteo.py` nutzt `timeout=(15, 45)` — der **Read-Timeout von 45 s** ist für große Bulk-Requests (50 Punkte, `minutely_15` über 180 Schritte + `hourly` über 132 h) zu knapp. Bei Lastspitzen antwortet Open-Meteo regelmäßig erst nach 30–60 s, was die im Log sichtbaren `Read timed out` auslöst. Zusätzlich starten 3 Worker parallel — bei einem Batch-Fail blockiert der Retry minutenlang und alle anderen laufen währenddessen ungekoppelt weiter.

Hinweis aus dem Logausschnitt: Im aktuellen Run steht `read timeout=15`, obwohl der Code 45 enthält — das deutet auf eine alte Cache-Version des Scripts in der Action hin (oder eine frühere Revision). Wir setzen den Wert explizit höher und eindeutig.

## Änderungen in `scripts/ingest_openmeteo.py`

1. **Timeout deutlich anheben und konfigurierbar machen**
   - `connect=15s`, `read=120s` (default), beides via ENV `OM_CONNECT_TIMEOUT` / `OM_READ_TIMEOUT` überschreibbar.

2. **Sanftere Backoff-Strategie**
   - Nicht-429-Fehler: `10, 20, 45, 90, 180` s statt `3, 10, 30, 60, 120`.
   - 429: bleibt bei ~60–120 s (Open-Meteo Minutenlimit).
   - Mehr Versuche: 7 statt 5.
   - Kleiner Jitter (±20 %) damit parallele Worker nicht synchron retryen.

3. **Defaults konservativer**
   - `FETCH_WORKERS` Default 3 → **2** (Workflow setzt ohnehin nichts).
   - Im Workflow `CHUNK_PHASE1` von 50 → **30** (kleinere Bulk-Payloads = stabilere Antwortzeiten). Andere Chunks bleiben.

4. **Letzten Cache als Fallback für phase1 nutzen**
   - Aktuell beendet ein finaler phase1-Fehler das Script mit `sys.exit` und der R2-Cache wird gar nicht überschrieben.
   - Stattdessen: `phase1 = chunk_fetch(..., optional=True)` und bei `None` auf `prev["phase1"]` zurückfallen (mit Log). So bleibt der Cache aktuell genug, statt komplett zu altern.

## Änderungen in `.github/workflows/openmeteo-ingest.yml`
- `CHUNK_PHASE1: "30"` (war `"50"`).
- Neu: `OM_READ_TIMEOUT: "120"`, `FETCH_WORKERS: "2"`.

## Nicht-Ziele
- Keine Änderungen an `radar.functions.ts`, R2-Pfaden oder am Symbol-Workflow.
- Keine Änderungen am Frontend.

## Verifikation
- Workflow manuell triggern, Log prüfen: alle 16 Batches `ok` ohne mehrfach gescheiterte Versuche.
- Bei künstlich provoziertem Fehler: `forecast.json` wird trotzdem mit altem phase1 + neuem phaseC neu geschrieben.
