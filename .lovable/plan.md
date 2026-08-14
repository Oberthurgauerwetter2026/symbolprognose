# Lokalprognose: alter Tag in den Tageskacheln

## Befund

Die Tageskacheln nehmen die ersten 7 Einträge der Tagesreihe der Serverantwort, ohne zu prüfen, ob der erste Eintrag noch der gestrige Tag ist (`daily.time.slice(0, 7)` in `src/components/weather-widget.tsx`). Der aktuell verfügbare MeteoSchweiz-Lauf ist vom Vortag (STAC-Item 13.08., 04:00 UTC), sein Tagesdatensatz beginnt entsprechend beim Vortag. Deshalb erscheint links noch die alte Kachel, während die Stundenreihe (die Vergangenheit bereits ausfiltert) mit heute beginnt.

Nicht verifiziert: dass der Server für jeden Ort exakt beim Vortag beginnt — die Kürzung wird deshalb datumsbasiert und nicht per festem Offset gemacht.

## Änderung (nur Darstellung)

1. Im `days`-Memo zuerst alle Tage vor dem heutigen Datum (Zeitzone Europe/Zurich) verwerfen, danach auf 7 Tage begrenzen. Ergebnis: erste Kachel ist immer heute.
2. Die Tagesindizes (`idx`) weiter auf die Original-Tagesreihe zeigen lassen, damit Tageswerte (Min/Max, Niederschlagssumme, Symbol) unverändert korrekt zugeordnet bleiben.
3. Auswahl-/Scroll-Logik auf die gekürzte Liste beziehen: gewählter Tag, `initialDayIdx` aus der URL und die Obergrenze der Stundenslots (`lastDayIso`) arbeiten weiterhin auf `days`, sodass Panelkopf und Kacheln synchron bleiben. Fällt der über die URL angeforderte Tag weg, wird auf den ersten verbliebenen Tag gesetzt.
4. Keine Änderung an Datenquellen, Ingest oder Aggregation.

## Technische Details

- `src/components/weather-widget.tsx`: im `days`-Memo Zurich-Heute als `YYYY-MM-DD` bestimmen und `daily.time` per String-Vergleich filtern (`iso >= todayIso`), Index des Originalarrays beibehalten, danach `slice(0, 7)`.
- Stellen prüfen, die von `days[i].idx === i` ausgingen (Tageskachel-Auswahl, Detailpanel-Kopf, Tages-Zusammenfassung) und auf `idx` bzw. Listenposition korrekt umstellen.

## Prüfung

- Kachelreihe beginnt mit dem heutigen Wochentag; Stundenpanel beginnt mit der aktuellen Stunde.
- Wechsel zwischen Kacheln zeigt die passenden Stunden; Typecheck und Build laufen durch.
