## Plan

Ich würde den Radar-Ingest robuster machen, damit er MeteoSchweiz-STAC-Assets auch dann findet, wenn der STAC-Asset-Key nicht direkt mit `cpc` oder `bzc` beginnt.

### Änderung

1. **Asset-Erkennung erweitern**
   - In `scripts/ingest_radar.py` nicht nur `asset_key.startswith(prefix)` prüfen.
   - Zusätzlich den Dateinamen aus `href`, `title` und `description` auswerten.
   - Den Zeitstempel aus dem tatsächlichen `.h5`-Dateinamen parsen.
   - Passende `.h5`-Assets behalten, wenn irgendwo ein gültiger `cpc...`- bzw. `bzc...`-Dateiname erkannt wird.

2. **Diagnose im GitHub-Log verbessern**
   - Pro STAC-Tagesitem ausgeben, wie viele Assets vorhanden sind.
   - Wenn 0 Frames gefunden werden, 3 Beispiel-Asset-Keys und Hrefs loggen.
   - Dadurch sieht man beim nächsten Run sofort, ob die API leer ist, die Namen anders sind oder die Zeitfilterung greift.

3. **Zeitfilter sichtbarer machen**
   - Im Log zeigen, ob Assets wegen `since` verworfen wurden.
   - Optional `RADAR_LOOKBACK_HOURS` im Workflow auf einen etwas großzügigeren Wert setzen, falls der MeteoSchweiz-Feed zeitversetzt aktualisiert wird.

### Erwartetes Ergebnis

Beim nächsten manuellen GitHub Actions Run sollte im Schritt **Run ingest** sichtbar sein, welche STAC-Items geladen wurden und warum Assets behalten oder verworfen werden. Wenn die Asset-Namen wie erwartet im `href` stehen, erscheinen danach wieder mehrere `candidate frames` und `radar/frames.json` wird mit Frames gefüllt.