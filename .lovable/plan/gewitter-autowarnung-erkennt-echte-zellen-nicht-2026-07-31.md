# Gewitter-Autowarnung: erkennt echte Zellen nicht

## Befund (geprüft)

Der Lauf funktioniert (letzter Lauf 16:33, alle 5 Min, `0 erkannt`). Das Problem sind nicht die Schwellenwerte, sondern die Datengrundlage:

- Die Automatik wertet ausschliesslich das **ICON-CH1-Prognosefeld** aus (`phase1` im R2-Cache), nicht die **Radarmessung**. Die Zelle im Screenshot ist eine Messung — sie kann darum gar nicht erkannt werden.
- Das im Cache gespeicherte Prognosefeld ist auf ein **grobes Gitter (22 × 36 Punkte, ~5–7 km)** heruntergerechnet; das dichte 1-km-Feld existiert nur als Bild-Kacheln. Eine Gemeinde im Oberthurgau enthält damit oft nur 0–2 Gitterpunkte, und `regionOf()` zählt nur Punkte, die **exakt im Polygon** liegen. Zellen am Gemeinderand fallen durch.
- Zusätzlich glättet das Modell konvektive Spitzen: aus 40 mm/h Messung wird im 15-Min-Mittel schnell < 8 mm/h — also unter Stufe 1.

Die Schwellen 8 / 15 / 30 mm/h sind für konvektiven Niederschlag plausibel und bleiben.

## Änderung

1. **Messung als Auslöser**: Der Radar-Ingest schreibt pro 5-Min-Frame zusätzlich eine kompakte Kennzahl-Datei nach R2 (`radar/region-max.json`): je Oberthurgau-Gemeinde die maximale Intensität in mm/h und die maximale Hagelwahrscheinlichkeit (POH) des aktuellen Frames.
2. **Auswertung**: Die Autowarnung nutzt künftig das Maximum aus Messung (jetzt) und Prognose (nächste 3 h). Bei Messwerten gilt die Warnung sofort (kein 30-Min-Vorlauf, die Zelle ist schon da); für Prognosewerte bleibt der 30-Min-Vorlauf wie bisher.
3. **Randproblem beheben**: Gitterpunkte werden nicht mehr nur "im Polygon" gezählt, sondern der nächstgelegenen Gemeinde innerhalb von ~3 km zugeordnet, damit Zellen am Gemeinderand nicht verloren gehen.
4. Warntexte, Stufen, Push-Verhalten und das 5-Min-Intervall bleiben unverändert; im Text wird bei Messwerten "aktuell gemessen" statt "erwartet" formuliert.

## Technische Details

- `scripts/ingest_radar.py`: nach dem Rastern auf die bbox (`sample_to_bbox`) je Region aus `src/data/region.json` (Point-in-Polygon, plus 3-km-Toleranz) das Maximum von `precip` (mm/h) und `poh` (%) bilden und als `radar/region-max.json` (mit `t`-Zeitstempel) hochladen.
- `src/lib/auto-thunder.server.ts`: neue Quelle einlesen (via R2-Public-URL, wie die anderen Caches), `perRegion` mit `measuredMax` erweitern, `levelFor(max(measured, forecast))`, `firstMs = now` bei Messwert (umgeht `LEAD_MS`), Beschreibung entsprechend anpassen.
- `src/lib/openmeteo-cache.server.ts` bzw. ein kleiner Helper: Lesefunktion für `radar/region-max.json` mit 60-s-Memo.
- Region-Zuordnung: bestehende `REGION_POLYS`-Logik um Nearest-Region-Fallback (Distanz zum Polygonschwerpunkt, Limit 3 km) erweitern.
- Nach dem Deploy sichtbar: `job_runs.detected` > 0, sobald eine Zelle über einer Gemeinde liegt.
