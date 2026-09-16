# Wettersymbole korrekt an Tag und Nacht koppeln

## Problem
In der kompakten Stundenübersicht erscheint z. B. um 02:00 ein Sonnensymbol. Grund: Diese Ansicht übergibt keine Tag/Nacht-Information, deshalb wird immer „Tag“ angenommen. In der ausführlichen Stundenprognose wird zwar Tag/Nacht gesetzt, aber pauschal mit 06:00–20:00 statt mit dem echten Sonnenauf- und -untergang des jeweiligen Tages.

## Ziel
Jedes Wettersymbol richtet sich nach dem tatsächlichen Sonnenauf- und -untergang des passenden Kalendertages: nachts Mond statt Sonne, tagsüber Sonne. Gilt für Lokalprognose (kompakt und vollständig), Wetterkarte Region und die statischen Einbettungen.

## Umsetzung
1. **Eine gemeinsame Tag/Nacht-Regel**
   - Eine zentrale Hilfsfunktion bestimmt aus einem Stundenzeitpunkt und den Tageswerten für Sonnenaufgang/-untergang, ob es hell ist.
   - Sie sucht den zum Zeitpunkt passenden Kalendertag (nicht nur den ausgewählten Tag), damit auch Stunden nach Mitternacht korrekt als Nacht gelten.
   - Fehlen Sonnenzeiten, greift ein saisonaler Näherungswert statt der starren 06–20-Uhr-Regel.

2. **Kompakte Stundenübersicht**
   - Die nächsten Stunden übergeben Tag/Nacht an das Symbol; nachts erscheinen Mond-, Mond-mit-Wolke- und Nachtregen-Varianten.

3. **Vollständige Stundenprognose**
   - Die feste 06–20-Uhr-Annahme wird durch die neue Regel ersetzt.

4. **Wetterkarte Region und Einbettungen**
   - Die bestehende Sonnenlogik der Regionskarte wird auf die gemeinsame Funktion umgestellt, damit alle Ansichten identisch entscheiden.
   - Die serverseitig gerenderten statischen Symbole nutzen dieselbe Regel statt einer festen Stundenspanne bzw. eines festen „Tag“-Werts.

5. **Prüfung**
   - Stunden vor Sonnenaufgang und nach Sonnenuntergang zeigen keine Sonne mehr.
   - Stunden am Tag bleiben unverändert.
   - Regen-, Schnee- und Gewittersymbole bleiben inhaltlich gleich, nur die Tag/Nacht-Variante wechselt.

## Technische Details
- Neue Hilfsfunktion (z. B. `isDayAtIso(iso, daily)`) in `src/lib/weather.ts`, gespeist aus `daily.sunrise` / `daily.sunset`, mit Datumsabgleich über `time.slice(0,10)`.
- `src/components/weather-widget.tsx`: `CompactHourlyStrip` erhält `forecast.daily` und setzt `isDay`; in `DetailPanel` ersetzt die neue Funktion `t.getHours() >= 6 && t.getHours() < 20`.
- `src/components/region-map.tsx`: `computeIsDayFromSun` ruft die gemeinsame Funktion auf.
- `src/lib/embed-noscript.server.ts`: `isDayHour` nutzt die Sonnenzeiten des Prognosepakets; `src/routes/api/public/embed/region-lokal-static.ts` übergibt das Ergebnis statt `isDay: true`.
- Der bestehende MCH-Pictogramm-Pfad (`mchCode` 1–35 Tag / 101–135 Nacht) wird durch das übergebene `isDay` weiterhin korrekt überschrieben.
