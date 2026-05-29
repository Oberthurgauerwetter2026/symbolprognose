## Ziel

Der EPS-Ingest findet jetzt STAC-Items, scheitert aber beim GRIB-Decode, weil MeteoSchweiz ICON-EPS auf `unstructured_grid` liefert. `msg.latlons()`/`msg.values` reicht dafür nicht zuverlässig.

## Plan

1. **GRIB-Decoder robust machen**
   - `scripts/ingest_icon_eps.py` so anpassen, dass `_open_grib_messages()` bei `gridType == "unstructured_grid"` nicht abbricht.
   - Werte weiterhin aus dem GRIB lesen, aber Lat/Lon-Koordinaten über ecCodes-Keys (`latitudes`, `longitudes`) holen und als flache Arrays behandeln.

2. **Resampling für flache unstrukturierte Gitter unterstützen**
   - `_build_resample_index()` und `resample()` so erweitern, dass sie sowohl 2D-Gitter als auch 1D/unstrukturierte Punkte verarbeiten.
   - Ausgabe bleibt unverändert: 1024×768 PNG auf derselben WGS84-BBOX.

3. **Diagnostik verbessern**
   - Bei Decode-Fehlern zusätzlich relevante GRIB-Metadaten loggen (`gridType`, Anzahl Werte, verfügbare Lat/Lon-Keys), damit künftige Formatänderungen schneller sichtbar sind.

4. **Nicht ändern**
   - Kein Workflow-Timeout ändern.
   - Kein R2-/Manifest-/Frontend-Umbau.
   - Keine Änderung an STAC-Auswahl oder Upload-Struktur.

## Erwartetes Ergebnis

Beim nächsten manuellen Lauf sollten die Logs statt `unsupported grid unstructured_grid` etwa `building resample index from ... points` und danach `members=21` zeigen. Danach werden Mean-/Prob-PNGs erzeugt und `radar/eps/latest.json` geschrieben.