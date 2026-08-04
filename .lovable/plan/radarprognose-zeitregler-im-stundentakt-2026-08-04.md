# Radarprognose: Zeitregler im Stundentakt

Der Prognoseteil des Filmstrips rastet künftig auf volle Stunden statt auf jedes 15-Minuten-Feld. Die Messung bleibt unverändert im 5-Minuten-Takt.

## Was sich ändert

- Prognose-Schritte: 22:00, 23:00, 00:00 … also ein Schritt pro Stunde, deutlich weniger Scrollen.
- Es werden weiterhin nur echte Modellfelder gezeigt: eine Stundenmarke erscheint nur, wenn dazu ein Feld vorliegt (Toleranz wenige Minuten, falls die Kadenz leicht abweicht).
- Übergänge bleiben ruhige Überblendungen ohne Bewegungsberechnung; die Fade-Dauer passt sich automatisch an den grösseren Zeitschritt an (bestehende Deckelung).
- Abspieltempo bleibt gleichmässig, da die Schrittdauer aus dem Raster gelesen wird.

## Technische Umsetzung

Nur `src/components/maps/radar-map.tsx`, `timelineSteps` (ab Zeile ~1717):

- Prognose-Schleife über alle Frame-Zeiten ersetzen durch ein 60-Minuten-Raster ab der ersten vollen Stunde nach `nowMs` bis `lastMs`.
- Pro Rasterpunkt `pickNearest(t, ~4 min)`; nur bei Treffer den echten Frame-Zeitstempel pushen, sonst Stunde überspringen (keine synthetischen Zeitpunkte).
- Messteil und `push`-Dedup bleiben unverändert.

Playback (`gapAtMs`) und das Snapping in `filmstrip-timeline.tsx` übernehmen die neue Kadenz automatisch; keine Backend-/Ingest-Änderung.
