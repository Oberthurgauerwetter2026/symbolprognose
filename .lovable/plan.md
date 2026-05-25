## Befund

Dein aktueller GitHub-Action-Log enthält weiterhin nur:

```text
== precip (since ... ) ==
  0 candidate frames
== hail (since ... ) ==
  0 candidate frames
manifest: 0 frames
```

Im aktuellen Repository-Code müssten aber vor `0 candidate frames` zusätzliche Diagnosezeilen erscheinen, z. B.:

```text
lookback=12h since=...
STAC GET ... -> 200
item: total=... prefix=... matched=...
asset ts range: oldest=... newest=...
```

Dass diese Zeilen fehlen, bedeutet sehr wahrscheinlich: Die GitHub Action läuft nicht mit dem aktuellen Lovable-Code, sondern mit einem älteren Commit/Branch oder die Änderungen sind noch nicht in GitHub angekommen.

## Plan

1. **Workflow sichtbarer machen**
   - Im GitHub-Workflow vor dem Python-Aufruf explizit ausgeben:
     - aktuellen Commit-SHA
     - Branch/Ref
     - `RADAR_LOOKBACK_HOURS`
     - relevante Zeilen aus `scripts/ingest_radar.py`, damit sichtbar ist, welche Version wirklich läuft.

2. **Ingest-Startbanner ergänzen**
   - `scripts/ingest_radar.py` direkt beim Start eine eindeutige Versions-/Diagnosezeile ausgeben, z. B. `radar ingest diagnostics v2`.
   - So erkennt man sofort, ob GitHub die neue Datei ausführt.

3. **Robusteren Fallback einbauen**
   - Falls trotz STAC-Fund keine Frames nach `since` übrig bleiben, optional die neuesten verfügbaren Frames trotzdem verarbeiten, statt das Manifest auf `0 frames` zu setzen.
   - Damit bleibt die Karte nutzbar, auch wenn MeteoSchweiz-Daten verzögert sind.

4. **Manifest nicht leer überschreiben**
   - Wenn `0` neue Frames gefunden werden, aber ein bestehendes Manifest vorhanden ist, alte Frames innerhalb der Retention behalten.
   - Das verhindert, dass ein einzelner leerer Ingest-Run die Radar-Karte leer macht.

## Erwartetes Ergebnis

Der nächste Action-Run zeigt eindeutig, welcher Commit und welche Script-Version ausgeführt wird. Danach ist klar, ob es ein Sync-/Branch-Problem ist oder ob der Ingest selbst noch angepasst werden muss.