# Blitze in der Radar-Messung: Archiv wird bei jedem Lauf überschrieben

## Befund (geprüft)

Das aktuelle Blitzarchiv (`lightning/recent.json`, Stand 13:22 UTC) enthält nur **19 Blitze** — alle aus einem Zeitfenster von rund 80 Sekunden (13:21:06–13:22:27). Das Debug-Feld derselben Datei zeigt `strikesInBBox: 19` und `archiveStrikes: 19`: Beide Zahlen sind identisch, das heisst der Lauf hat **keinen einzigen älteren Blitz** aus dem bestehenden Archiv übernommen. Das 6-Stunden-Archiv wird also bei jedem Ingest-Lauf faktisch auf den letzten Lauf zurückgesetzt.

Folge im Niederschlagsradar: Nur der jüngste Zeitschritt kann Blitze zeigen, alle älteren Messschritte sind leer — genau das, was du siehst.

Zusätzlich: Jeder Lauf hört nur 120 Sekunden am Websocket zu, bei einem 5-Minuten-Takt bleiben also rund 3 Minuten pro Intervall ungehört. Selbst mit funktionierendem Archiv gäbe es systematische Lücken.

## Was geändert wird

1. **Archiv-Lesen zuverlässig machen**: Das bestehende Archiv wird nicht mehr über die öffentliche URL geholt (fehleranfällig, still verworfen), sondern direkt aus dem Speicher-Bucket mit denselben Zugangsdaten, mit denen auch geschrieben wird. Schlägt das Lesen fehl, wird der Lauf mit einer klaren Fehlermeldung abgebrochen statt das Archiv stillschweigend zu überschreiben.
2. **Schutz gegen Datenverlust**: Ein Lauf schreibt das Archiv nur, wenn das Zusammenführen plausibel ist (neue Datei enthält mindestens die alten Blitze innerhalb des 6-h-Fensters). Sonst bleibt die alte Datei stehen.
3. **Lückenlose Erfassung**: Zuhördauer pro Lauf auf die volle Intervall-Länge anheben (ca. 280 s bei 5-Minuten-Takt), damit zwischen zwei Läufen kaum Blitze verloren gehen.
4. **Diagnose**: Debug-Feld um `archiveFetched`, `archiveFetchError` und das älteste/jüngste Archiv-Datum erweitern, damit ein Rückfall in dieses Verhalten sofort sichtbar ist.

## Technisch

- `scripts/ingest_blitzortung.py`:
  - `_fetch_archive()` durch `_fetch_archive_s3(s3)` ersetzen (`get_object` auf `lightning/recent.json`, `NoSuchKey` = leeres Archiv, andere Fehler → Exception). S3-Client dafür vor dem Sammeln erstellen.
  - Bei Lesefehler (nicht `NoSuchKey`): Prozess mit Exit-Code ≠ 0 beenden, `latest.json` trotzdem schreiben, `recent.json` unverändert lassen.
  - `BO_LISTEN_S`-Default auf 280 erhöhen; Workflow-Env in `.github/workflows/blitzortung-ingest.yml` von `120` auf `280` anpassen, `timeout-minutes` entsprechend prüfen.
  - Debug-Felder ergänzen (`archiveFetched`, `archiveOldest`, `archiveNewest`, ggf. `archiveFetchError`).
- Keine Änderung an `src/lib/lightning.functions.ts` oder an der Radar-Darstellung nötig — die Frontend-Logik ist korrekt, ihr fehlten nur die Daten.
- Nach dem Fix füllt sich das Archiv erst über die nächsten Läufe; ältere Messschritte zeigen also erst nach einigen Zyklen (und nur bei tatsächlichem Gewitter) Blitze.
