## Plan: Radar-Ingest gegen Zeitversatz absichern

### Ziel
Der GitHub-Action-Run soll auch dann Radarframes finden, wenn MeteoSchweiz die aktuellen Dateien erst verzögert bereitstellt oder die Dateizeitstempel etwas hinter der aktuellen Uhrzeit liegen.

### Änderungen

1. **Lookback im Workflow vergrößern**
   - In `.github/workflows/radar-ingest.yml` `RADAR_LOOKBACK_HOURS` explizit auf einen robusteren Wert setzen, z. B. `12`.
   - Grund: Dein Log zeigt `since 2026-05-25T10:04...`; wenn die verfügbaren Frames z. B. bei `00:00–10:00` liegen, werden sie durch den sehr engen 3h-Filter komplett verworfen.

2. **Ingest-Log eindeutig machen**
   - In `scripts/ingest_radar.py` zusätzlich ausgeben:
     - verwendeter Lookback in Stunden
     - ältester/neuester erkannter Asset-Zeitstempel je Produkt
     - ob Frames wegen `since` verworfen wurden
   - Damit ist sofort sichtbar, ob `0 candidate frames` an leerer STAC-Antwort, falschem Prefix oder nur am Zeitfilter liegt.

3. **Asset-Erkennung leicht robuster machen**
   - Dateiname nicht nur aus `asset_key`/`href`/`title`, sondern auch aus `description` erkennen.
   - Asset-Key im Manifest weiterhin stabil halten, aber den echten `.h5`-Dateinamen fürs Timestamp-Parsing nutzen.

### Erwartetes Ergebnis
Nach dem nächsten manuellen GitHub Actions Run sollte der Log wieder mehrere `candidate frames` zeigen. Falls nicht, zeigt der Log konkret, ob die API Assets liefert und welche Zeitstempel verfügbar sind.