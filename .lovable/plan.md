Plan: Open-Meteo Ingest robuster gegen 502/504

Problem
- Open-Meteo Upstream-nginx liefert sporadisch 502 Bad Gateway / 504 Gateway Time-out.
- Aktuell: 3 Retries mit Backoff [2, 6, 18]s → gibt nach ~26s auf → ganzer Run failed.
- 502/504 sind typischerweise kurzlebige Upstream-Hänger; mit mehr Geduld + kleineren Batches geht es meistens durch.

Changes in `scripts/ingest_openmeteo.py`

1. **Mehr Retries, längerer Backoff** (Zeile 78 + 80):
   - `backoffs = [2, 6, 18]` → `backoffs = [3, 10, 30, 60, 120]`
   - `for attempt in range(3):` → `for attempt in range(5)`
   - Log-Message `attempt X/3` → `attempt X/5`, Fail-Message `after 3 attempts` → `after 5 attempts`
   → Gesamt-Wartezeit pro Batch im worst case ~3.5 Min statt 26s, deckt typische 502/504-Phasen ab.

2. **Kleinere Default-Chunks** (Zeile 194–196):
   - `CHUNK_PHASE1` default `60` → `30`
   - `CHUNK_PHASEA` default `40` → `25`
   - `CHUNK_PHASEC` default `80` → `40`
   → Halbiert die Last pro Request; Open-Meteo verarbeitet kleine Batches stabiler. ENV-Overrides bleiben funktional.

3. **502/504/503 explizit als retrybar markieren** (Zeile 85):
   - Aktuell wird `400 <= status < 500` als nicht-retrybar behandelt (korrekt), und `>=500` fällt durch in den Retry-Pfad. Das ist bereits ok — keine Änderung nötig.

Workflow `.github/workflows/openmeteo-ingest.yml`
4. Falls `timeout-minutes` < 15: auf `15` setzen (mehr Retries brauchen mehr Zeit). Prüfe ich beim Build.

Keine anderen Dateien betroffen. Frontend bleibt unverändert.