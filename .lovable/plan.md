## Befund

Die neue Version ist zwar live (`v11-cpc-tz-fix`), aber der Ansatz war falsch: Ich habe den Zeitstempel aus dem Dateinamen erneut umgerechnet. Die aktuellen MCH-Dateinamen enthalten aber offenbar nicht den Anzeige-Zeitpunkt im Format, das wir angenommen haben.

Beispiel aus dem aktuellen offiziellen STAC-Katalog:

```text
cpc2615116159_00060.001.h5
```

Das wurde bisher als `2026-05-31 16:15` interpretiert. Tatsächlich steckt im Suffix sehr wahrscheinlich die relevante Minuten-/Produktinformation (`...6159_00060...`), und der zuverlässigere Weg ist: nicht mehr aus dem Dateinamen raten, sondern den offiziellen Zeitstempel direkt aus der HDF5-Datei lesen.

## Plan

1. **Zeitstempel-Quelle korrigieren**
   - `parse_ts_from_filename()` nicht mehr als alleinige Wahrheit verwenden.
   - Beim Download der HDF5-Datei die internen ODIM-/MCH-Metadaten lesen (`/what`, `/dataset*/what`, `/dataset*/data*/what`), insbesondere `date`, `time`, `startdate`, `starttime`, `enddate`, `endtime`.
   - Den Bild-Zeitpunkt aus `enddate/endtime` oder `date/time` ableiten und erst dann als UTC ins Manifest schreiben.

2. **R2-Key und Manifest auf den echten Bild-Zeitpunkt umstellen**
   - PNG-Dateinamen (`radar/precip/YYYYMMDDTHHMM.png`) mit dem aus der Datei gelesenen Zeitstempel erzeugen.
   - `frames.json` damit automatisch mit der korrekten Zeit befüllen.
   - Version auf `v12-h5-metadata-time` bumpen und Workflow-Prüfung entsprechend aktualisieren.

3. **Alt-/Fehlframes bereinigen**
   - Alte `v11`-Frames mit falsch geratenem Zeitstempel dürfen nicht weiter im Manifest bleiben.
   - Im `v12`-Run das Manifest nur aus neu verarbeiteten oder korrekt benannten Frames aufbauen bzw. falsch gelabelte Altframes aus der relevanten Retention entfernen.

4. **UI unverändert lassen**
   - Keine zusätzlichen Zeitinfos wieder einbauen.
   - Keine Farbskala ändern, bis die Zeit wirklich synchron ist.

5. **Verifikation**
   - Nach Umsetzung prüfen:
     - Manifest-Version ist `v12-h5-metadata-time`.
     - Neueste `latestPrecipTs` passt zur offiziellen MeteoSchweiz-Anzeige.
     - Slider und Karten-Badge zeigen dieselbe lokale Zeit wie MeteoSchweiz.

## Technischer Kern

Die robuste Lösung ist, den `AssetRef.ts` nach dem HDF5-Download zu überschreiben:

```text
STAC asset gefunden
→ HDF5 laden
→ internen Bildzeitpunkt aus HDF5-Metadaten lesen
→ PNG unter echtem UTC-Zeitstempel speichern
→ Manifest aus diesen echten Zeitstempeln schreiben
```

Damit vermeiden wir Sommerzeit-/Dateinamen-Fehler vollständig.