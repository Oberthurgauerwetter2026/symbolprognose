## Stand (geprüft)

- Der Endpunkt `/api/public/warnings/auto-thunder` ist auf der veröffentlichten Seite **live** (Antwort 401 bei falschem Secret = Route existiert und ist abgesichert).
- Der Cron-Worker ist im Code so konfiguriert, dass er die Auto-Gewitterprüfung **alle 15 Minuten** auslöst (`WARN_TARGET_URL` gesetzt).
- Erkennung basiert auf den ICON-CH1-Viertelstundenwerten (dasselbe Feld wie die Radar-Prognose), Vorschau 3 Stunden, Schwellen 8 / 15 / 30 mm/h für Stufe 1 / 2 / 3.
- In der Datenbank existiert aktuell **keine einzige Warnung** (Tabelle leer). Das kann schlicht heissen: seit Aktivierung gab es kein Gewitter, das die Schwelle erreicht hat. Es kann aber auch heissen, dass der Cron-Lauf ins Leere läuft (Worker-Version veraltet oder Secret-Mismatch, wie zuvor beim Radar). Das ist **nicht verifiziert** – deshalb steht die Prüfung an erster Stelle.

Kurzantwort: technisch ja, aktiv – aber ob der Cron tatsächlich durchkommt, ist noch nicht bewiesen.

## Vorgehen

1. **Verifizieren, ob der Lauf wirklich stattfindet**
   - Auto-Thunder einmal manuell mit gültigem Secret auslösen und die Antwort auswerten (`detected`, `created`, `closed`, `note`).
   - Falls `note: "Nowcast-Daten nicht verfügbar"` kommt: Open-Meteo-Cache-Ingest ist die Ursache, nicht die Gewitterlogik.
   - Status-Endpunkt des Cron-Workers abfragen (`lastWarn`), um zu sehen, wann der letzte automatische Trigger lief und mit welchem HTTP-Status.

2. **Sichtbarkeit im Admin-Tool** (`/admin-warnungen`)
   - In der bestehenden Sektion «Datenquellen / Ingest» eine Zeile «Gewitter-Autowarnung» ergänzen: letzter Lauf, Anzahl erkannter Zellen, letzte Meldung, Ampel (grün < 30 Min, gelb < 2 h, rot älter).
   - Button «Jetzt prüfen», der den Lauf sofort auslöst und das Ergebnis anzeigt.
   - Dafür wird der letzte Lauf serverseitig protokolliert (Zeitpunkt, detected/created/closed, note), damit der Status auch ohne manuellen Klick stimmt.

3. **Was beim nächsten echten Gewitter passiert**
   - Erreicht eine Zelle in einer Gemeinde ≥ 8 mm/h, entsteht innert max. 15 Minuten automatisch eine Warnung (Quelle «automatisch») mit Titel, Kurztext im neuen Vorlagenstil, Spitzenintensität und Zugbahn.
   - Sie erscheint sofort auf Warnkarte, Banner, in den Widgets und geht als Push raus; sie wird automatisch beendet, sobald die Intensität wegfällt.

## Technische Details

- Protokoll des letzten Auto-Laufs in einer kleinen Tabelle bzw. als Zeile in der bestehenden Ingest-Status-Quelle, gelesen über eine Server-Funktion analog `getIngestStatus`.
- Manueller Auslöser über eine authentifizierte Server-Funktion (analog `runIngestNow`), nicht über das öffentliche Cron-Secret im Browser.
- Keine Änderung an Schwellen oder Warntexten in diesem Schritt.
