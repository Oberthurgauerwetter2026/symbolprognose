# Prognose-Animation: Advektion statt Morphing

## Ziel
Zwischen zwei Modellzeitpunkten der Niederschlagsprognose wird ein Bewegungsfeld berechnet. Die Niederschlagsfelder werden entlang dieses Feldes verschoben (advectiert), statt linear ineinander überzublenden. Form und Struktur der Zellen bleiben erhalten, die Intensität darf sanft interpolieren. Daraus entstehen Zwischenframes im 15-Minuten-Raster (:00, :15, :30, :45).

## Ausgangslage (geprüft)
- Prognose-Frames kommen als PNG (`precipUrl`) und werden aktuell in `MeasurementCanvasOverlay` einzeln dekodiert und ohne Zwischenschritt gezeichnet — pro Zeitschritt ein harter Bildwechsel.
- Das frühere advektive Resampling im `PrecipOverlay` wurde entfernt (Kommentar im Code: wackelnde Bänder wegen pro Framepaar wechselnder Shift-Vektoren).
- Die Timeline liefert bereits einen kontinuierlichen `renderMs` plus Framepaar (`frame`, `nextFrame`, `progress`) über `timelineStateForMs`.

## Vorgehen

### 1. Bewegungsfeld aus zwei dekodierten Feldern
Neues Modul `src/lib/radar-flow.ts` (rein clientseitig, arbeitet auf den bereits dekodierten mmh-Rastern):
- Grobe Vorschätzung per Kreuzkorrelation auf einer stark reduzierten Pyramide (globaler Verschiebungsvektor, robust gegen Rauschen).
- Verfeinerung per Horn–Schunck auf 2–3 Pyramidenstufen mit dem globalen Vektor als Startwert; Ergebnis ist ein dichtes, geglättetes Flussfeld (u, v) in Pixel pro Modellintervall.
- Flussfeld wird zusätzlich zeitlich stabilisiert (gleitende Mittelung über die letzten Framepaare), damit die Bänder nicht mehr wackeln wie bei der alten Implementierung.
- Ergebnis wird pro Framepaar (Schlüssel: beide Zeitstempel) gecacht.

### 2. Bidirektionale Advektion beim Zeichnen
`MeasurementCanvasOverlay` erhält optional ein zweites Feld plus `progress`:
- Feld A wird um `progress · flow` vorwärts advectiert, Feld B um `(1 − progress) · flow` rückwärts.
- Beide Ergebnisse werden mit `progress` gewichtet zusammengeführt — die Gewichtung betrifft nur die Intensität, die Geometrie kommt aus der Advektion.
- Advektion per Backward-Warping mit bilinearer Abtastung, danach dieselbe Farbband-Zuordnung wie heute (keine zusätzliche Glättung, identische Optik zur Messung).
- Bei fehlendem Nachbarframe oder unbrauchbarem Fluss (zu kleines Signal) fällt der Layer auf das reine Einzelfeld zurück.

### 3. 15-Minuten-Zwischenframes
- Im Prognoseteil der Timeline bleibt/wird das Raster auf volle Viertelstunden fixiert (:00, :15, :30, :45).
- Liegt kein echter Modellframe auf einem Viertelstundenschritt (z. B. bei Stundenfeldern), wird der Schritt aus dem umgebenden Framepaar advectiert erzeugt — er ist damit ein echter Zwischenframe, kein Duplikat.
- Beim Abspielen wird zusätzlich zwischen den Viertelstunden weiter advectiert, damit die Bewegung flüssig statt sprunghaft ist.

### 4. Messung bleibt unverändert
Der Messteil (5-Minuten-Radarframes) zeigt weiterhin exakt die gemessenen Bilder ohne Advektion.

## Technische Details
- Kein Backend- oder Ingest-Eingriff nötig: alles auf den im Browser dekodierten mmh-Rastern der bestehenden PNGs.
- Rechenaufwand: Flussberechnung auf halber Auflösung, Warping auf voller Auflösung, Ergebnisse gecacht; Zeichnen bleibt in `requestAnimationFrame`.
- Betroffene Dateien: neu `src/lib/radar-flow.ts`; angepasst `src/components/maps/radar-map.tsx` (Overlay-Props, Framepaar-Übergabe, Prognose-Raster).
