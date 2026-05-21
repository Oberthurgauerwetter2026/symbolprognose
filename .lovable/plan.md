## Ziel
Genauere Bodensee‑Form aus swisstopo, durchgehender Zeit‑Schieberegler ab "jetzt" über mehrere Tage, leicht stärkerer Standard‑Zoom.

## 1. Bodensee aus swisstopo
swisstopo führt den Bodensee in `ch.swisstopo.swisstlm3d-gewaessernetz_seen` (TLM, vollständige Uferlinie inkl. DE/AT). Ich hole die Geometrie einmalig per WFS / api3 und ersetze damit `src/data/lake.json`:

- Quelle: `https://api3.geo.admin.ch/rest/services/api/MapServer/identify` mit `layer=ch.swisstopo.swisstlm3d-gewaessernetz_seen`, BBox um den Bodensee, `geometryFormat=geojson`.
- Ergebnis als reines GeoJSON `FeatureCollection` mit dem Bodensee‑Polygon (Obersee + Untersee) speichern → `src/data/lake.json`.
- Keine Code‑Änderung nötig — `region-map.tsx` rendert `LAKE` bereits aus dieser Datei mit dem blauen Stil.
- Die Aussenmaske `OUTSIDE_MASK` stanzt den See automatisch mit aus (collectet `LAKE` bereits).

Falls der Abruf scheitert oder die Geometrie zu komplex ist (>2 MB), nehme ich als Fallback eine vereinfachte, aber akkurate Version (z.B. via mapshaper auf ~200 Stützpunkte vereinfacht).

## 2. Schieberegler ab jetzt, rollt automatisch in den nächsten Tag
Bisher: Slider 0–7 (= 00–21 Uhr) pro ausgewähltem Tag. Heute beginnt er bei "jetzt", andere Tage ab 00.

Neu: **ein durchgehender Zeitstrahl ab jetzt**, der über die folgenden Tage hinweg läuft.

- Neuer Slider‑Wert `stepOffset`: Anzahl 3‑h‑Schritte ab "jetzt".
  - `0` = aktueller 3‑h‑Slot (z.B. 15:00 Uhr).
  - `1` = +3 h, `2` = +6 h, …
- Maximaler Wert: bis Ende der verfügbaren Vorhersage (typischerweise Tag 5–7, also `max = 5 * 8 = 40` oder anhand der `data.hourly.time`‑Länge berechnet — ich nehme 5 Tage × 8 = 40 als sicheren Default).
- Aus `stepOffset` wird live abgeleitet:
  - `absoluteHour = currentBaseHour + stepOffset * 3` (currentBaseHour = aktueller Slot, z.B. heute 15:00 → 15)
  - `dayIndex` = `Math.floor(absoluteHour / 24)` (rollt automatisch in den nächsten Tag)
  - `hourOfDay = absoluteHour % 24`, Anzeige z.B. "Mi · 03:00".
- **Tagesleiste** wird zur reinen **Anzeige**, kein Umschalter mehr — der aktive Tag wird gehighlighted, abgeleitet aus `dayIndex`. (Alternative: Tagesleiste bleibt klickbar und springt den Slider auf 00:00 des Tages — sag bitte, was du bevorzugst; ich nehme im Default die Anzeige‑Variante.)
- Slider‑Label oben zeigt zusätzlich den Wochentag, da der Slot auch morgen sein kann: z.B. `Do · 06:00`.
- Wettersymbol pro Marker holt `hourly.weathercode[absoluteHour]` (statt `dayIndex*24 + hourStep*3`).
- Min/Max‑Temperatur in der Marker‑Pille bleibt **Tageswert** (`daily.*[dayIndex]`), reagiert also automatisch auf den abgeleiteten `dayIndex`.

Effekt: Schiebt man von "jetzt" nach rechts, läuft die Zeit kontinuierlich weiter — irgendwann zeigt die Tagesleiste "Morgen", dann "Do" usw.

## 3. Etwas stärkerer Standard‑Zoom
- `bounds`‑Berechnung in `RegionMap`: `extended`‑Padding reduzieren (`±0.005` statt `±0.015 / ±0.02`).
- `boundsOptions.padding` von `[24, 24]` auf `[12, 12]`.
- `minZoom` bleibt `11`, `maxZoom` `15`.

Damit liegt der Standard‑Zoom etwa eine halbe Stufe enger — Region füllt mehr Fläche, Bodensee bleibt aber sichtbar.

## Nicht geändert
- swisstopo‑Hintergrund (Leichte Basiskarte), graue Aussenmaske, grünliche Region, Marker‑Pille, Bodensee‑Label, Region‑Klick → `/`.

## Offene Punkte
- Tagesleiste: nur Anzeige oder weiterhin als Sprungziel klickbar? Default: nur Anzeige (passt zu "rollt automatisch in den nächsten Tag"). Sag Bescheid, wenn klickbar bleiben soll.
- Maximale Slider‑Länge: 5 Tage = 40 Schritte. Mehr nur sinnvoll, wenn ICON‑CH2 verlässlich Daten liefert.
