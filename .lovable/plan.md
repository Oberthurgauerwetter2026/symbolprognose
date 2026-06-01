## Plan

1. **Ursache gezielt beheben**
   - Der Daten-Merge ist bereits kategorial umgestellt, aber das angezeigte Tagesicon kann weiterhin durch die Icon-Logik auf `IconRain` fallen.
   - Konkret: Wenn ein Tag als Schauer-Code `80/81` klassifiziert ist, soll die Tagesmenge bzw. 100% Wahrscheinlichkeit daraus nicht wieder ein Dauerregen-Symbol machen.

2. **Icon-Dispatcher anpassen**
   - In `src/components/weather-icons/index.tsx` die Daily-Logik so ändern, dass:
     - `80` und `81` immer das Schauer-/Drizzle-Symbol behalten.
     - `82` nur bei wirklich markantem Starkregen als kräftiges Regensymbol bleibt.
     - Der Niederschlags-Override nicht gegen bereits nasse WMO-Codes arbeitet.
   - Dadurch wird Amriswil, Dienstag 2. Juni mit Schauer-Code nicht mehr als Dauerregen-Icon dargestellt.

3. **Beschriftung/Signal konsistent halten**
   - Falls nötig `weatherLabel` prüfen/anpassen, damit Tooltip/ARIA nicht „Regen“ sagt, wenn der Code Schauer meint.

4. **Validierung**
   - Die relevanten Stellen in der Vorschau prüfen: Tageskachel „Morgen / Di 2. Jun“ soll nicht mehr das Dauerregen-Symbol zeigen, sondern das Schauer-Symbol passend zum kategorialen Code.