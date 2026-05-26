## Änderungen

**`scripts/ingest_openmeteo.py`** robuster machen:

1. `fetch()` mit Retries: 3 Versuche, exponentielles Backoff (2/6/18 s), Timeout pro Versuch 120 s. Fängt `Timeout`, `ConnectionError`, `SSLError` ab.
2. Neuer Parameter `optional=True`: nach allen Retries Warnung + `None` zurückgeben statt `sys.exit`.
3. **`phase2` (ICON-CH2) entfernen** — Worker nutzt nur noch ICON-CH1 (+32 h). Im Payload als leere Liste mitgeben (Backwards-Compat).
4. **`phaseC` als optional**: bei Fehler `phaseC: null` in den Payload statt Abbruch.
5. `phase1` + `phaseA` bleiben hart.
