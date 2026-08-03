# Prognose-Filmstrip auf 15-Minuten-Raster

Variante B: Der Prognoseteil im Niederschlagsradar rastet künftig genau auf die echte Datenkadenz der Prognose (15 Minuten) statt auf 30-Minuten-Schritte. Die Messung bleibt unverändert im 5-Minuten-Takt.

## Was sich für dich ändert

- Prognose-Schritte alle 15 Minuten, jeder Schritt entspricht einem echten Prognosebild — keine rein virtuellen Zwischenzeiten mehr.
- Mehr Detail beim Scrubben, dafür etwas mehr Schritte auf dem Strip.
- Abspieltempo passt sich automatisch an (kürzere Abstände laufen schneller durch), Morphing bleibt flüssig.

## Technische Umsetzung

In `src/components/maps/radar-map.tsx`, `timelineSteps` (ab Zeile ~1700):

- `HALF = 30min` durch `QUARTER = 15min` ersetzen, Toleranz für das Einrasten auf ~±4 Minuten reduzieren.
- Startpunkt: erste Viertelstunde nach `nowMs`, danach in 15-Minuten-Schritten bis `lastMs`.
- Wenn ein realer Prognose-Frame innerhalb der Toleranz liegt, exakt dessen Zeitstempel verwenden; sonst die virtuelle Rasterzeit (falls die Kadenz später abweicht).
- Doppelte Zeitstempel weiterhin entfernen.

Playback (`gapAtMs`) und das visuelle Snapping in `filmstrip-timeline.tsx` übernehmen die neue Kadenz automatisch — keine weiteren Änderungen nötig.
