## Plan

Der Fehler entsteht, weil der neueste STAC-Item `20260619-ch` zwar als aktuellster Lauf erscheint, aber aktuell `0` Assets enthält. Das Script nimmt ihn trotzdem und findet deshalb keinen einzigen Parameter.

Ich werde den Ingest so anpassen:

1. **STAC-Auswahl robuster machen**
   - `latest_item()` wählt nicht mehr blind den neuesten Item.
   - Es prüft die neuesten Items der Sammlung und nimmt den neuesten, der tatsächlich CSV-Assets enthält.
   - Zusätzlich wird validiert, dass mindestens zentrale Forecast-Parameter wie Temperatur oder Wettercode vorhanden sind.

2. **Logging verbessern**
   - Wenn ein leerer Item übersprungen wird, wird das klar geloggt.
   - Der gewählte Fallback-Item wird mit ID, Datum und Asset-Anzahl ausgegeben.

3. **Abbruchlogik beibehalten**
   - Falls gar kein brauchbarer Item gefunden wird oder weiterhin keine Hourly-Daten entstehen, bricht das Script weiterhin ab und überschreibt keinen funktionierenden Cache.

4. **Kurztest ohne Upload**
   - Den relevanten STAC-Auswahlteil lokal prüfen, damit der aktuell leere `20260619-ch` übersprungen und `20260618-ch` gewählt wird.