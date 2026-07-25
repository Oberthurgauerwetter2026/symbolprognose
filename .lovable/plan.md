## Plan

1. **Noch offenen Snow-Zweig schließen**
   - Im `WeatherIcon`-Dispatcher die WMO-Schnee-Codes `71–77` und `85–86` nicht mehr mit einer separaten `> 3 °C`-Regel behandeln.
   - Stattdessen denselben temperaturgefilterten Snow-Status verwenden wie bei `isSnow`: stündlich Schnee nur bis `2 °C`, täglich nur bis `3 °C`.
   - Wenn ein Schnee-WMO-Code bei warmen Temperaturen kommt, wird er als Regen/Schauer gerendert, nicht als Schnee.

2. **MCH-Gewitter-Schnee-Code absichern**
   - Im `mchToIcon`-Mapping auch Code `35` (`Schnee + Gewitter`) temperaturabhängig herabstufen.
   - Bei Temperaturen über ca. `2–3 °C` wird daraus ein normales Gewitter-/Regen-Gewitter-Icon statt Schneeflocken.

3. **Server-SVG synchronisieren**
   - Die gleiche Logik in `src/lib/weather-icon-svg.server.ts` nachziehen, damit statische Embeds/Noscript nicht weiterhin Schnee anzeigen.

4. **Verifikation**
   - Gezielt prüfen, dass ein Icon mit `code=85/86` oder `isSnow=true` bei `18 °C` keine Schneeflocken mehr rendert.
   - Gegenprobe: Bei `-2 °C` müssen Schnee-Icons weiterhin erscheinen.