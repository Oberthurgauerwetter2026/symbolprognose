# Radar-Prognose: erste Stunden im 15-Minuten-Takt, danach Stundentakt

## Ziel

Fade-Fenster und Reglerschritt sollen überall zusammenpassen. Statt die ersten Stunden auf Stundenschritte zu zwingen (wodurch der Übergang dort wegfällt), rastet der Regler dort auf die echten 15-Minuten-Felder von ICON-CH1. Ab dem Moment, in dem nur noch Stundenfelder vorliegen, läuft er im Stundentakt weiter.

## Verhalten

- **Messung**: unverändert 5-Minuten-Takt, harte Frame-Wechsel.
- **Prognose, erster Abschnitt (ICON-CH1, ~24–33 h)**: Schritte alle 15 Minuten, jeweils ein echtes Feld pro Schritt.
- **Prognose, späterer Abschnitt**: Schritte im Stundentakt wie heute.
- **Übergänge**: Der Fade läuft immer über den ganzen Schritt (15 min bzw. 60 min), also auch in den ersten Stunden sichtbar weich — gleiche Kurve, gleiches Fenster wie bisher.
- **Abspieltempo**: bleibt gleichmässig, weil die Schrittdauer aus dem Raster gelesen wird; die 15-Minuten-Phase läuft entsprechend feiner durch.
- Bewusster Kompromiss: im vorderen Prognosebereich gibt es wieder mehr Schritte im Filmstrip (4 statt 1 pro Stunde).

## Technische Umsetzung

Nur `src/components/maps/radar-map.tsx`, `timelineSteps`:

- Prognoseteil in zwei Phasen aufbauen:
  1. 15-Minuten-Raster ab dem nächsten Viertelstundenpunkt nach `nowMs`, Toleranz ~2 min, solange zu den Rasterpunkten echte Felder existieren (das entspricht dem ICON-CH1-Fenster mit `precipUrl`).
  2. Danach das bestehende 60-Minuten-Raster (Toleranz 4 min) bis `lastMs`.
- Wie heute nur echte Frame-Zeitstempel pushen, keine synthetischen Punkte; `push`-Dedup bleibt.
- Messteil, `fadeWeight` (0.55, Perlin-Smoothstep), `QSTEPS` und die Overlay-Logik bleiben unverändert — der Fade passt dann automatisch zum Schritt, weil Nachbarfeld und nächster Reglerschritt wieder identisch sind.
- `gapAtMs` (Playback) und das Snapping in `filmstrip-timeline.tsx` übernehmen die Kadenz automatisch.
- Keine Backend-/Ingest-Änderung.

## Validierung

- Preview: Play vom Prognosestart über die Grenze zum Stundentakt — durchgehend weiche Übergänge, kein harter Schnitt.
- Scrubben im vorderen Bereich: Bubble-Zeit rastet auf 15-Minuten-Marken.
