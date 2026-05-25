Ich habe die veröffentlichte Seite geprüft: Der Fehler ist nicht mehr der R2-Manifest-Pfad, sondern Open-Meteo blockiert aktuell die Radar-Serverfunktion mit `429 Daily API request limit exceeded`. Weil die Serverfunktion alle Daten per `Promise.all` lädt, schlägt die ganze Radaransicht fehl, obwohl die echten R2-Radarbilder verfügbar sein sollten.

Plan:
1. `src/lib/radar.functions.ts` so anpassen, dass das R2-Manifest zuerst geladen wird und echte Radarframes sofort nutzbar bleiben.
2. Open-Meteo-Aufrufe fehlertolerant machen: Wenn Open-Meteo 429/timeout liefert, wird nicht die ganze Radaransicht abgebrochen.
3. Fallback-Verhalten definieren: Bei Open-Meteo-Ausfall zeigt die Karte mindestens die vorhandenen MeteoSchweiz-Radarbilder aus R2; nur die Prognoseframes fehlen temporär.
4. Optional eine kleine Statusinfo im bestehenden Radar-UI anzeigen, wenn die Prognosedaten gerade nicht verfügbar sind, statt pauschal „Radardaten konnten nicht geladen werden“.

Technische Details:
- `Promise.all([fetchOpenMeteo(p1), fetchOpenMeteo(p2), fetchR2Manifest()])` wird ersetzt durch isolierte Fehlerbehandlung pro Datenquelle.
- `fetchOpenMeteo` soll Fehler nicht mehr zwingend bis zur UI durchwerfen, wenn R2-Daten vorhanden sind.
- Das Payload kann ein optionales Warnfeld bekommen, damit die UI zwischen „keine Daten“ und „nur Prognose temporär nicht verfügbar“ unterscheiden kann.