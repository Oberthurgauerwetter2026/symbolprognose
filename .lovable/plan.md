## Plan

Ich behebe den Ingest gezielt an der Stelle, an der aktuell alle Frames verworfen werden.

### Ursache
Der Workflow läuft mit aktuellem Code, aber `0 candidate frames` ohne `note:` bedeutet sehr wahrscheinlich: Die STAC-Assets heißen nicht mehr mit Asset-Key `cpc...`/`bzc...`, sondern der Zeitstempel steckt im Asset-`href` oder einem anderen Feld. Der Code prüft bisher nur `asset_key.startswith(prefix)` und übersieht dadurch alle passenden H5-Dateien.

### Umsetzung
1. `scripts/ingest_radar.py` robuster machen:
   - Nicht nur Asset-Key prüfen, sondern auch Dateiname aus `href`, `title` und `description`.
   - Zeitstempel aus dem tatsächlichen H5-Dateinamen extrahieren.
   - Assets mit `.h5` und passendem Produktpräfix behalten, auch wenn der STAC-Key anders heißt.
2. Diagnose verbessern:
   - Wenn keine Frames gefunden werden, im Log ausgeben, wie viele Assets vorhanden waren und 3 Beispiel-Keys/Hrefs zeigen.
   - So ist beim nächsten GitHub-Run sofort sichtbar, ob MeteoSchweiz die Struktur erneut geändert hat.
3. Kleine lokale Smoke-Prüfung ergänzen/ausführen:
   - Die öffentliche STAC-Abfrage gegen heutiges Tages-Item testen.
   - Prüfen, dass mindestens aktuelle `precip`/`hail` AssetRefs erkannt werden, bevor der Workflow wieder laufen soll.

### Erwartetes Ergebnis
Beim nächsten manuellen Run steht im Schritt **Run ingest** nicht mehr `0 candidate frames`, sondern mehrere Kandidaten; danach wird `radar/frames.json` mit Frame-URLs geschrieben und `/karten/radar` kann Bilder anzeigen.