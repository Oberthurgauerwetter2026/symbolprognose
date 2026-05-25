## Nächste Schritte

Da der KNMI API Key jetzt als GitHub Secret `KNMI_API_KEY` hinterlegt ist:

1. **Workflow manuell triggern** zum Testen
   - GitHub Repo → Actions → "Lightning Ingest" → "Run workflow"
   - Prüfen, ob der Job ohne Fehler durchläuft (HDF5 Download + Parsing + Upload)

2. **Ergebnis verifizieren**
   - Logs des Workflow-Runs prüfen (Anzahl geparster Blitze)
   - In der App auf `/karten/radar` die Lightning-Overlay-Punkte sichten

3. **Cron-Schedule aktiv lassen**
   - Workflow läuft automatisch alle 5 Minuten (bereits in `.github/workflows/lightning-ingest.yml` konfiguriert)

4. **Falls Fehler auftreten**
   - Workflow-Logs teilen → ich debugge HDF5-Parsing oder Auth-Header

Aktuell sind **keine Code-Änderungen** nötig. Sag Bescheid, sobald der erste Workflow-Run durch ist, oder schick mir die Logs falls etwas schiefgeht.