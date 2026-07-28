## Ursache (verifiziert)

Im Admin-Formular (`src/routes/admin-warnungen.tsx`) blockiert das Flag `touchedText` die Textaktualisierung:

- `applyTemplate` (Zeilen 199–211) setzt Beschreibung/Auswirkungen nur, wenn `touchedText === false`.
- `touchedText` wird bei jeder manuellen Änderung an Titel/Beschreibung/Auswirkungen auf `true` gesetzt — und zusätzlich beim Öffnen einer bestehenden Warnung zum Bearbeiten (Zeile 287).

Sobald man also einmal im Text getippt oder eine bestehende Warnung geöffnet hat, ändert die Eingabe der Böenspitzen (bzw. mm/cm/°C) den Warntext nicht mehr.

## Änderungen

1. **Wert-Änderung erzeugt Text neu, solange der Text unverändert ist.**
   Statt eines einfachen „einmal berührt = nie mehr“-Flags wird verglichen, ob der aktuelle Text noch exakt dem zuletzt generierten Vorlagentext entspricht. Ist er unverändert, wird er bei jeder Änderung von Gefahr, Stufe oder Mengenwerten neu erzeugt — auch beim Bearbeiten einer bestehenden Warnung, wenn deren Text noch der Vorlage entspricht.

2. **Sichtbarer Hinweis + Button „Text aus Vorlage neu erzeugen“.**
   Wurde der Text manuell angepasst, bleibt er erhalten (kein Datenverlust), und über dem Beschreibungsfeld erscheint ein kleiner Hinweis mit einem Button, der Titel, Beschreibung und Auswirkungen mit den aktuellen Werten neu aus der Vorlage aufbaut.

3. **Bereichsdarstellung im Text prüfen.**
   `combineValue` liefert bereits „20 bis 40“; in den Vorlagen steht „von {v} km/h“, was zu „von 20 bis 40 km/h“ wird — korrekt. Bei nur einem Wert bleibt „von 75 km/h“. Keine Änderung nötig, wird nur verifiziert.

## Technische Details

- Betroffene Datei: `src/routes/admin-warnungen.tsx`
- `touchedText` wird durch einen Vergleich mit einem `lastTemplateRef` (zuletzt generierte Texte) ersetzt; `edit()` setzt kein pauschales „berührt“ mehr, sondern befüllt die Referenz aus der Vorlage der geladenen Warnung.
- Keine Änderungen an Datenbank, Server-Funktionen oder Push-Versand.
- Abschliessend Typecheck und Prüfung von `/admin-warnungen`.
