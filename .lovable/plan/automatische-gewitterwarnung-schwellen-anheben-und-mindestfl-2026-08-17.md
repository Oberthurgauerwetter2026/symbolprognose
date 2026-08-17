# Automatische Gewitterwarnung: Schwellen anheben und Mindestfläche einführen

## Ziel

Die Radar-Autowarnung löst zu häufig aus. Künftig warnt sie erst bei höheren Intensitäten und nur, wenn die Zelle eine gewisse Fläche über der Schwelle abdeckt — einzelne Radar-Pixel genügen nicht mehr.

## Änderungen

1. **Neue Schwellen (mm/h)**: Stufe 1 ab 20, Stufe 2 ab 40, Stufe 3 ab 60 (bisher 15 / 30 / 50).
2. **Mindestfläche**: Eine Gemeinde wird nur gewarnt, wenn mindestens 3 zusammenhängende Radar-Pixel (~3 km²) über der Stufenschwelle liegen. Ein einzelner Ausreisser-Pixel löst keine Warnung mehr aus.
3. Der Radar-Ingest liefert dafür je Gemeinde neben der Spitzenintensität zusätzlich die robuste Intensität (höchster Wert, der von genügend Fläche gestützt wird). Die Warnstufe wird aus diesem Wert bestimmt; im Warntext steht weiterhin die gemessene Spitzenintensität.
4. Die im Warn-Tool angezeigte Skala wird auf 20 / 40 / 60 mm/h aktualisiert, damit Anzeige und Automatik übereinstimmen.
5. Warntexte, Push-Verhalten, 5-Minuten-Takt, Zugbahn-Angabe und das Beenden nicht mehr erkannter Warnungen bleiben unverändert.

## Technische Details

- `src/lib/warnings-config.ts`: `THUNDER_RAIN_MMH` auf `[20, 40, 60]`. Passende `THRESHOLDS.gewitter`-Zeile (Regenintensität pro Stunde) mitziehen, damit die Schwellenanzeige konsistent bleibt.
- `scripts/ingest_radar.py`, `write_region_max()`: je Region zusätzlich `mmhArea` schreiben — der höchste Schwellenwert, bei dem die Anzahl Pixel ≥ Schwelle im Regionsraster mindestens `MIN_CELL_PIXELS = 3` beträgt (praktisch: Werte im Maskenbereich absteigend sortieren und den 3.-höchsten nehmen; bei weniger als 3 Pixeln entsprechend 0). `RADAR_INGEST_VERSION` und `EXPECTED_RADAR_INGEST_VERSION` in `.github/workflows/radar-ingest.yml` gemeinsam auf `v25-area-threshold` anheben.
- `src/lib/openmeteo-cache.server.ts`: Typ der Regionen um optionales `mmhArea` erweitern.
- `src/lib/auto-thunder.server.ts`: `levelFor()` erhält `mmhArea` (Fallback `mmh`, solange der alte Ingest-Stand läuft); die Textausgabe nutzt weiterhin `mmh`.
- `src/routes/admin-warnungen.tsx`: Hinweistext „warnt ab 8 mm/h …" auf „ab 20 mm/h (Stufe 1), 40 mm/h (Stufe 2), 60 mm/h (Stufe 3)" korrigieren.
- Wirksam nach Deploy; die Mindestflächen-Prüfung greift ab dem ersten neuen Radar-Ingest-Lauf (5-Minuten-Takt).
