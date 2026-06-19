Ich werde die fehlenden Werte an der Datenquelle beheben, nicht nur im Layout.

## Plan

1. **Tagesaggregation korrigieren**
   - Regenmenge als echte 24h-Tagessumme berechnen.
   - Niederschlagswahrscheinlichkeit als Tagesmaximum aus den Stundenwerten berechnen.
   - Windmittel/Maximum, Böen und dominante Windrichtung aus den Stundenwerten in die Tagesdaten übernehmen.

2. **MeteoSchweiz-Lokalquelle vollständig anreichern**
   - Die lokale Primärquelle liefert aktuell nicht alle Tagesfelder; deshalb werden Wind/Regenwahrscheinlichkeit sauber aus `hourly` abgeleitet.
   - Sonnenaufgang und Sonnenuntergang werden aus der vorhandenen Fallback-Prognose übernommen, wenn sie in der lokalen Quelle leer sind.

3. **MOSMIX-Overlay konsistent halten**
   - Nach dem MOSMIX-Merge werden die Tageswerte erneut vollständig berechnet, damit späte Tage ebenfalls Wind/Regenwerte bekommen.
   - Sonnenzeiten bleiben erhalten bzw. werden aus dem Fallback gefüllt.

4. **Frontend-Cache aktualisieren**
   - Die Forecast-Version im Widget wird erhöht, damit der Browser nicht weiter alte `v9`-Daten anzeigt.

5. **Prüfung**
   - `/karten/lokal?lat=47.5466&lon=9.2958&name=Amriswil` prüfen.
   - Erwartung: Übersicht zeigt Regenwert/NS-Wahrscheinlichkeit, Wind/Böen, Sonnenschein sowie Sonnenauf-/untergang. Bei trockener Prognose bleibt Regen korrekt `0.0 mm / 0 %`, aber nicht wegen fehlender Daten.