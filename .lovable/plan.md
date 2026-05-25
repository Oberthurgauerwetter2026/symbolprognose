## Befund

Der Ingest findet `0 candidate frames`, obwohl MeteoSchweiz aktuell Assets liefert. Die Ursache liegt sehr wahrscheinlich im Timestamp-Parser:

- Niederschlag-Dateien sehen aktuell so aus: `cpc2614500000_00060.001.h5`
- Hagel-Dateien sehen aktuell so aus: `bzc261450000vl.845.h5`
- Der aktuelle Regex erwartet nach Prefix + Jahr + Tag exakt 2 Stellen Stunde + 2 Stellen Minute.
- Bei MeteoSchweiz steckt dort aber häufig ein zusätzlicher Lead-/Sequenz-Zifferblock bzw. eine 5-stellige Zeitkennung (`00000`, `00050`, `12450` usw.). Dadurch werden die Dateien nicht zuverlässig als neue Frames erkannt.

## Plan

1. **Timestamp-Parser reparieren**
   - `parse_ts_from_filename()` so umbauen, dass er beide aktuellen Muster korrekt liest:
     - CPC: `cpcYYDOYHHMM...` bzw. `cpcYYDOY0HHMM...`
     - BZC/Hagel: `bzcYYDOYHHMM...` bzw. `bzcYYDOY0HHMM...`
   - Minutenwerte wie `005`, `010`, `035` bei Hagel korrekt als `00:05`, `00:10`, `00:35` interpretieren.
   - Ungültige Zeiten defensiv verwerfen statt falsche Frames zu erzeugen.

2. **Ingest-Debug-Ausgabe verbessern**
   - Wenn keine Kandidaten gefunden werden, konkrete Sample-Dateinamen plus Parser-Ergebnis loggen.
   - So sieht man im nächsten GitHub Actions Run sofort, ob Parsing oder Upload das Problem ist.

3. **Manifest-Schutz beibehalten**
   - Den bestehenden Schutz, dass ein leerer Lauf ein bestehendes Manifest nicht überschreibt, unverändert lassen.
   - Damit wird nicht wieder versehentlich `frames.json` auf 0 Frames gesetzt, sobald einmal echte Frames vorhanden sind.

4. **Validierung**
   - Lokal mit aktuellen STAC-Dateinamen prüfen, dass für `precip` und `hail` Kandidaten gefunden werden.
   - Erwartung nach dem nächsten GitHub Actions Run: `candidate frames > 0`, danach `manifest: ... frames` und in der App `hasRealRadar: true`.

## Technische Details

Die Änderung betrifft voraussichtlich nur `scripts/ingest_radar.py`. Keine UI-Änderung und keine neuen Secrets nötig.