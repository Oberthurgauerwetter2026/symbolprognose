## Befund

Der Ingest findet STAC-Items und lädt die GRIBs korrekt, aber der neue `unstructured_grid`-Pfad greift auf `msg["latitudes"]` / `msg["longitudes"]` zu. Bei den MeteoSchweiz ICON-EPS-Dateien sind diese ecCodes-Keys offenbar nicht verfügbar, deshalb wird jede GRIB-Message mit `RuntimeError('Key/value not found')` verworfen und es entstehen keine Member.

## Plan

1. **Diagnostik zuerst reparieren**
   - Die Fehlerausgabe in `_open_grib_messages()` so ändern, dass sie nie selbst an fehlenden Keys scheitert.
   - Statt `msg.shortName`/`getattr(...)` direkt zu lesen, sichere Helper verwenden, damit Logs künftig `gridType`, `numberOfDataPoints`, `NV`, `paramId`, `shortName` soweit verfügbar ausgeben.

2. **Unstructured-Lat/Lon robust laden**
   - Einen Helper `_get_grib_array(msg, candidates)` einführen, der mehrere mögliche ecCodes-Key-Namen versucht und sauber `None` zurückgibt.
   - Für `unstructured_grid` mehrere Koordinatenquellen probieren, z. B. `latitudes/longitudes`, `distinctLatitudes/distinctLongitudes`, `latitudeOfFirstGridPointInDegrees`-Varianten, falls verfügbar.
   - Wenn keine Koordinaten im GRIB vorhanden sind, klar loggen: `unstructured grid has values but no coordinates`, statt hunderte identische Skip-Zeilen.

3. **Falls Koordinaten fehlen: static grid cache vorbereiten**
   - Für ICON-CH1/CH2 native grid braucht es wahrscheinlich ein externes/statisches Grid-Mapping über `uuidOfHGrid` oder `numberOfGridUsed`.
   - Implementieren: einmalige Grid-Resolver-Funktion, die pro Modell/Grid-ID eine lokale/remote Koordinatentabelle laden kann und danach im Prozess cached.
   - Wenn keine Grid-Datei im Repo vorhanden ist, bleibt der Ingest mit präziser Diagnose stehen; danach können wir die passende CH1/CH2-Griddatei gezielt hinzufügen oder herunterladen.

4. **Resampling unverändert weiterverwenden**
   - Sobald `values`, `lats`, `lons` gleiche Länge haben, läuft der vorhandene 1D-Resampler weiter.
   - Keine Änderung an R2-Struktur, Manifest, Frontend oder Workflow-Timeout.

5. **Validierung**
   - Beim nächsten Workflow-Lauf sollten die Logs entweder `building resample index from (...)` und `members=21` zeigen, oder eine eindeutige Meldung, welche Grid-ID/UUID eine externe Koordinatendatei benötigt.