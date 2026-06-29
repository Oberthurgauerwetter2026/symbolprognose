## Plan

Das Problem kommt nicht mehr von der Frame-Auswahl, sondern von der Anzeige/Interpolation: Beim Play und Scrubben läuft `visualMs` bzw. `dragMs` kontinuierlich, dadurch zeigt die Bubble in der Prognose Minuten wie 14:40, 14:41, 14:42 statt auf die Filmstrip-Cadence zu snappen.

## Umsetzung

1. **Anzeigezeit auf Cadence-Frame snappen**
   - In `FilmstripTimeline` wird die Bubble-Zeit für Drag/Play nicht mehr aus dem kontinuierlichen `dragMs`/`visualMs` formatiert.
   - Stattdessen zeigt sie die Zeit des aktuell gesnappten `displayIdx` aus `stripFrames`.

2. **Filmstrip-Bewegung ruhig halten**
   - Der Marker/Strip kann weiterhin weich/reaktiv bewegt werden, aber die angezeigte Zeit und das Radarbild bleiben cadence-basiert.
   - Ergebnis: Prognose 0–24 h zeigt 15-min-Schritte, danach 60-min-Schritte; keine minütlichen Labels mehr.

3. **Scrubben korrigieren**
   - Beim Draggen bleibt `snapAndEmit` auf der reduzierten `stripFrames`-Liste aktiv.
   - Die Bubble springt nur auf die vorhandenen Filmstrip-Schritte, nicht auf Zwischenminuten.

4. **Kontroll-Log entfernen oder reduzieren**
   - Den temporären `console.info('[radar] filmstrip steps...')` entferne ich, damit die Konsole sauber bleibt.

## Verifikation

- Auf `/karten/radar` Play in der Prognose prüfen: Bubble läuft nicht mehr minütlich.
- Scrubben in der Prognose prüfen: Zeit springt in 15-min-Schritten bis +24 h und danach stündlich.