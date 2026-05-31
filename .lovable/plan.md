## Befund

Die aktuelle Live-Ausgabe zeigt `v12-h5-metadata-time`, aber der neueste Niederschlags-Frame ist `2026-05-31T14:55:00Z` und damit ca. 134 Minuten alt, obwohl im offiziellen Katalog bereits Dateien bis etwa `17:00Z` vorhanden sind. Zusätzlich gibt es zwei konkrete Fehlerquellen im Code:

1. **Falscher Skip vor dem HDF5-Decode:** Der Main-Loop prüft vor `process_asset()` mit dem aus dem Dateinamen geratenen Zeitstempel, ob ein PNG existiert. Dadurch werden Dateien übersprungen, bevor der echte HDF5-Zeitstempel gelesen wird.
2. **Falsche Intensität möglich:** Die Niederschlagswerte werden zuerst dekodiert und erst danach anhand `quantity` konvertiert. Wenn das Produkt bereits `RATE` ist, kann die aktuelle Logik je nach HDF5-Metadaten überhöhte/verfälschte Werte erzeugen. Sicherer ist: CPC-Rohprodukt explizit als Akkumulationsprodukt behandeln bzw. anhand Plausibilitätsgrenzen konservativ skalieren.

## Plan

1. **Radar-Ingest auf einen sicheren Modus zurücksetzen**
   - Version auf `v13-safe-cpc-rebuild` erhöhen.
   - `parse_ts_from_filename()` wieder als robuste Zeitquelle für CPC/BZC nutzen: `YY + DOY + HHMM` ist UTC, nicht Europe/Zurich.
   - HDF5-Metadaten nur noch als Diagnose/Fallback verwenden, nicht als alleinige Wahrheit, solange sie offensichtlich nicht zur STAC-Aktualität passt.

2. **Skip-Fehler entfernen**
   - Vor dem HDF5-Download nicht mehr anhand des alten/geratenen Keys skippen.
   - `process_asset()` entscheidet erst nach der finalen Zeit- und Produktlogik, ob der Ziel-Key existiert.
   - Damit können neue Frames nicht mehr durch falsch gelabelte Alt-Keys blockiert werden.

3. **Alte/verfälschte Frames konsequent bereinigen**
   - Bei Version-Wechsel alle alten `radar/precip/*.png` und `radar/hail/*.png` purgen.
   - `write_manifest()` auf die letzten Stunden begrenzen und nicht mehr alte Restbestände übernehmen.
   - Wenn ein Run 0 brauchbare Frames produziert, nicht still alte Frames weiteranzeigen, sondern Manifest mit klarer Fehler-/Leerdiagnose schreiben.

4. **Intensität konservativ korrigieren**
   - CPC-Werte so skalieren, dass normale Niederschlagsraten plausibel bleiben und nicht künstlich aufgeblasen werden.
   - Bei extremen Maxima/P99-Werten eine automatische Schutzskalierung anwenden und im Log sichtbar machen.
   - Farbskala im Frontend unverändert lassen, bis Datenbasis wieder sauber ist.

5. **Nowcast/Forward-Fill entschärfen**
   - Forward-Fill alter Messbilder deaktivieren oder stark begrenzen, damit keine alten Frames als neue Messung erscheinen.
   - Nowcast erst wieder nutzen, wenn mindestens zwei bis drei echte, zeitlich plausible Radarframes vorhanden sind.

6. **Verifikation nach Umsetzung**
   - Syntaxcheck des Scripts.
   - Offizielle STAC-Tail-Zeit gegen erwartete Manifest-Zeit vergleichen.
   - Debug-Endpunkt muss danach zeigen:
     - Version `v13-safe-cpc-rebuild`
     - `latestPrecipTs` nahe am neuesten offiziellen CPC-Dateinamen
     - keine stundenalten Frames im Messbereich
     - keine unerklärlichen Intensitäts-Überläufe

## Dateien

- `scripts/ingest_radar.py`
- `.github/workflows/radar-ingest.yml`
- optional klein in `src/lib/radar.functions.ts`, falls Forward-Fill/Nowcast serverseitig deaktiviert oder begrenzt werden muss