# Gewitter-Autowarnung: Mittelweg einstellen

Die letzte Runde (Stufe 2 ab 30 mm/h, 12 km², 2–3 Läufe, Push-Sperre 60 Min.) ist zu zurückhaltend. Wir drehen auf einen Mittelweg zurück: früher auslösen, weniger Flächenanspruch, häufigere Pushs — Stufe 1 bleibt aber weiterhin ohne Automatik (MeteoSchweiz-Praxis).

## Änderungen

1. **Schwellen tiefer**: Stufe 2 ab 25 mm/h, Stufe 3 ab 45 mm/h (bisher 30 / 50). Stufe 1 (15 mm/h) bleibt nur für manuell erfasste Warnungen.
2. **Fläche kleiner**: mind. 8 Radar-Pixel (~8 km²) über der Schwelle statt 12.
3. **Bestätigung unverändert**: Stufe 2 zwei Radarläufe in Folge, Stufe 3 drei Läufe, Fenster 15 Minuten. Eine laufende Warnung wird wie bisher sofort weitergeführt.
4. **Push häufiger**: Wiederholsperre pro Warnung von 60 auf 30 Minuten; Höherstufung pusht weiterhin sofort.
5. **Admin-Tool**: Hinweistext auf „ab 25 mm/h (Stufe 2) bzw. 45 mm/h (Stufe 3) über mind. 8 km², bestätigt durch zwei Radarläufe" aktualisieren.

## Technische Details

- `src/lib/warnings-config.ts`: `THUNDER_RAIN_MMH` → `[15, 25, 45]`, Kommentar zur Herkunft und zur Automatik anpassen.
- `src/lib/auto-thunder.server.ts`: `RENOTIFY_MS` auf 30 Min.; `AUTO_MIN_LEVEL = 2` und die Zähler-Persistenz bleiben unverändert. Kommentare zur Fläche (8 statt 12 Pixel) nachziehen.
- `scripts/ingest_radar.py`: `MIN_CELL_PIXELS = 8`, `RADAR_INGEST_VERSION = "v28-area8"`.
- `.github/workflows/radar-ingest.yml`: `EXPECTED_RADAR_INGEST_VERSION` auf `v28-area8`.
- `src/routes/admin-warnungen.tsx`: Beschreibungstexte (Schwellen, Fläche) angleichen.

Wirksam nach Deploy; die kleinere Mindestfläche greift ab dem ersten neuen Radar-Ingest-Lauf (5-Minuten-Takt).
