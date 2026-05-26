## Open-Meteo 502 beheben — Requests in Chunks aufteilen

**Datei:** `scripts/ingest_openmeteo.py` (nur Symbolprognose-Repo, das andere Repo bleibt unverändert)

### Ursache

Mit der jüngsten Grid-Erweiterung auf **240 Punkte** (12 × 20) wird die Open-Meteo-Antwort für `phase1` (240 × 180 15-Min-Werte) und besonders `phaseA` (240 × 168 h × 12 Variablen × 5 Modelle ≈ mehrere MB JSON) so gross, dass der vorgelagerte nginx mit **HTTP 502** abbricht. Das ist serverseitig und nicht durch Retries lösbar — die einzige stabile Lösung ist, die Punkte-Liste in kleinere Batches zu zerlegen.

### Änderungen

1. **Neue Hilfsfunktion `chunk_fetch(label, base_params, pts, chunk_size, optional)`**
   - Zerlegt `pts` in Batches von z. B. `chunk_size = 60` Punkten.
   - Baut pro Batch `latitude`/`longitude`-Strings, ruft das bestehende `fetch(...)` auf, hängt die Ergebnislisten in der Reihenfolge der Eingabepunkte zusammen.
   - Bricht hart ab, wenn ein Pflicht-Batch nach den 3 Retries scheitert; bei `optional=True` wird die ganze Phase übersprungen (Verhalten wie bisher).
   - Reihenfolge bleibt deterministisch identisch zum bisherigen Einzelaufruf — Worker/Frontend bekommen die Locations in derselben Reihenfolge wie `grid.points`.

2. **Drei Phasen-Calls auf `chunk_fetch` umstellen**
   - `phase1`: `chunk_size = 60` (ICON-CH1 minutely_15, hohe Zeitauflösung → kleinere Chunks).
   - `phaseA`: `chunk_size = 40` (Multi-Modell hourly+daily, sehr breite Antwort → noch kleinere Chunks).
   - `phaseC`: `chunk_size = 80` (best_match, schmal → grössere Chunks OK).
   - Pro Aufruf weiterhin 3 Retries mit Backoff (2/6/18 s) via bestehender `fetch()`-Logik.

3. **Konfigurierbar via ENV**
   - `CHUNK_PHASE1` (default 60), `CHUNK_PHASEA` (default 40), `CHUNK_PHASEC` (default 80) — falls Open-Meteo künftig wieder mehr verträgt, ohne Code-Edit anpassbar.

4. **Logging**
   - Pro Batch eine Zeile: `phaseA batch 2/6 (40 pts) ok`. So sieht man im Action-Log sofort, wo es hängt.

### Nicht geändert

- BBox, Grid-Auflösung (12 × 20 = 240), Variablen-Set, Modelle, R2-Upload, Output-Schlüssel.
- Keine Änderung am Worker/Frontend nötig — Payload-Form bleibt 1:1 gleich.
- Das andere Repo (`Oberthurgauerwetter2026`) wird nicht berührt.

### Erwartete Wirkung

- Jeder einzelne HTTP-Call zu Open-Meteo ist klein genug, dass nginx ihn ohne Timeout durchreicht → keine 502 mehr.
- Laufzeit der Action steigt von ~10 s auf ~30–60 s (mehrere sequentielle Calls). Liegt weiterhin deutlich unter dem 5-Min-Cron-Intervall.
- Tageslimit: aus 3 Requests werden ~14 Requests pro Lauf → 288 Cron-Läufe × 14 ≈ 4 000 Requests/Tag, weiterhin im Free-Tier.
