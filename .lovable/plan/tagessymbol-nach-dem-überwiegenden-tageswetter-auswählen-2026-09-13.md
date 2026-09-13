# Tagessymbol nach dem überwiegenden Tageswetter auswählen

## Ziel
Das Tagessymbol zeigt nur dann Regen, wenn Regen die Tagesstunden tatsächlich mehrheitlich prägt. Bei überwiegend trockenen Stunden wird stattdessen das repräsentative trockene Symbol für Sonne und Bewölkung angezeigt.

## Umsetzung
1. **Klare Mehrheitsregel in der Tagesaggregation**
   - Die bereits verwendeten Tagesstunden von 06:00 bis 21:00 Uhr auswerten.
   - Eine Stunde ab 0,1 mm als Niederschlagsstunde zählen.
   - Regen nur als dominantes Tagessymbol zulassen, wenn mindestens die Hälfte dieser Stunden nass ist.
   - Bei überwiegend trockenen Stunden das häufigste plausible trockene Wetterbild wählen und trockene Regen-/Gewittercodes aus der Auswahl entfernen.

2. **Darstellung gegen widersprüchliche Tagescodes absichern**
   - In der sichtbaren Symbolkomponente dieselbe Mehrheitsregel anwenden, damit ein angelieferter Regen-Tagescode bei wenigerheitlichen Regenstunden nicht doch wieder Tropfen zeigt.
   - Die identische Regel im serverseitigen SVG-Renderer übernehmen, damit Website, Regionskarte und statische Einbettungen dasselbe Symbol zeigen.

3. **Betroffene Ansichten prüfen**
   - Lokalprognose und Wetterkarte Region mit einem Tag prüfen, der nur wenige Regenstunden enthält: kein Regen im Tagessymbol.
   - Einen überwiegend nassen Tag gegenprüfen: Regensymbol bleibt erhalten.
   - Stundenprognosen unverändert lassen; dort wird Regen weiterhin stundengenau angezeigt.

## Technische Details
- `src/lib/weather.ts`: Tagescode anhand `precipitation_hours` gegenüber trockenen Tagesstunden priorisieren; trockene Mehrheitsstunden bestimmen das repräsentative Symbol.
- `src/components/weather-icons/index.tsx`: tägliche Regen-, Schnee- und Gewitterzweige nur bei einer nassen Mehrheit als dominantes Niederschlagssymbol rendern.
- `src/lib/weather-icon-svg.server.ts`: dieselbe Entscheidung für statische Vorschauen und Einbettungen spiegeln.
- Die Niederschlagsmenge und Regenwahrscheinlichkeit bleiben sichtbar; geändert wird nur das zusammenfassende Tagessymbol.
