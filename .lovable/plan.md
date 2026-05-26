## Fix: 429 sauber behandeln in `scripts/ingest_openmeteo.py`

### Problem
In `fetch()` führen alle 4xx (inkl. **429 Too Many Requests**) sofort zu `sys.exit()` — auch wenn `optional=True`. Damit:
- greift der R2-Fallback für phaseA nicht, wenn Open-Meteo das Minutenlimit meldet
- wird der GitHub-Job rot, obwohl 429 nach 60s wieder weg ist

### Änderung in `fetch()` (Phase 1: Statuscode-Handling)

Sonderbehandlung für **429** vor dem generischen 4xx-Block:

```python
if r.status_code == 429:
    # Minutenlimit — retrybar, längeres Backoff
    last_err = RuntimeError(f"HTTP 429 rate-limited: {r.text[:200]}")
    # fällt durch in den retry-Block unten
elif 400 <= r.status_code < 500:
    # echte 4xx (400/401/404 …) bleiben hart
    msg = f"open-meteo HTTP {r.status_code} ({label}): {r.text[:300]}"
    if optional:
        print(f"WARN: {msg} — skipping (optional)")
        return None
    sys.exit(msg)
else:
    last_err = RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
```

Backoffs für 429 etwas verlängern: aktuell `[3, 10, 30, 60, 120]` reicht — die 120s am Ende decken das Minutenlimit gut ab. Keine Änderung an der Backoff-Liste nötig.

### Was damit funktioniert

- **phase1 + 429**: retried 5× bis 120s — typischerweise reicht ein 60s/120s-Wait, um wieder durchzukommen. Erst wenn auch danach 429 kommt, wird der Job rot (korrekt: Radar-Cache ist dann veraltet).
- **phaseA + 429**: retried 5×; bleibt es bei 429 → `optional=True` greift → Fallback auf `openmeteo/forecast.json` aus R2 (bereits implementiert).
- **phaseC + 429**: identisch zu phaseA, optional, kein Fallback nötig.

### Nicht geändert
- `.github/workflows/openmeteo-ingest.yml`
- Reihenfolge phase1 → phaseC → phaseA bleibt
- Chunk-Grössen bleiben
- Worker / Frontend bleiben

### Erwartetes Bild im nächsten Lauf
Wenn Open-Meteo das Minutenlimit wirft: 1-2 Retries mit Wait, dann ok. Falls phaseA trotzdem scheitert → Cache-Fallback, Symbolprognose bleibt vom letzten Lauf. Radar bleibt frisch.
