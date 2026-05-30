## Warum es hängt

Der Screenshot zeigt: `Open-Meteo Cache Ingest` wartet auf Lauf #30. Weil der Workflow `concurrency.cancel-in-progress: false` nutzt und der Cloudflare-Cron alle 5 Minuten weiter dispatcht, entsteht eine Warteschlange. Das erklärt Open-Meteo direkt.

Der Radar hängt wahrscheinlich nicht wegen derselben GitHub-Concurrency-Gruppe, sondern weil entweder:
- der Radar-Ingest seit 19:45 nicht mehr erfolgreich `radar/frames.json` schreibt,
- ein alter Workflow/Run die R2-Dateien überschreibt,
- oder die App/R2-URL noch gecachte alte Frames liefert.

## Plan

1. **Open-Meteo-Queue entschärfen**
   - In `.github/workflows/openmeteo-ingest.yml` `cancel-in-progress: true` setzen, damit neue 5-Minuten-Runs alte wartende/laufende Open-Meteo-Runs abbrechen statt eine Schlange zu bilden.
   - BBox/Grid wie zuvor vorgeschlagen verkleinern: 504 → 240 Punkte.
   - `CHUNK_PHASE1` erhöhen, damit der Lauf kürzer wird.

2. **Symbol-Open-Meteo konsistent halten**
   - In `.github/workflows/openmeteo-symbol.yml` dieselbe BBox/Grid verwenden, damit phaseA und Forecast-Cache dieselbe Region abdecken.

3. **Radar gegen Stau absichern**
   - In `.github/workflows/radar-ingest.yml` ebenfalls `cancel-in-progress: true` setzen. Radar ist ein 5-Minuten-Feed; alte Runs sind wertlos, sobald ein neuer Tick kommt.
   - Optional `RADAR_LOOKBACK_HOURS` bei 6 lassen, damit nach einem Ausfall genügend Frames nachgezogen werden.

4. **Cloudflare-Worker-Trigger trennen/entlasten**
   - Open-Meteo nicht mehr bei jedem 5-Minuten-Tick parallel mit Radar/EPS triggern, sondern auf einen langsameren Rhythmus oder nur jeden zweiten Tick reduzieren, falls nötig.
   - Radar bleibt alle 5 Minuten.

5. **Nach Umsetzung prüfen**
   - GitHub Actions: Es darf nur noch der neueste Open-Meteo-Run laufen; keine wachsende Warteschlange.
   - Radar-Workflow: neuer Run muss `radar/frames.json` mit aktuellem Timestamp schreiben.
   - Falls published Endpoint noch 404/HTML liefert: App erneut publishen, weil der Worker die veröffentlichte Domain trifft.

## Technische Änderung

Die kleinste sichere Änderung ist:

```yaml
concurrency:
  group: openmeteo-ingest
  cancel-in-progress: true
```

und analog für Radar. Für Echtzeitdaten ist `cancel-in-progress: false` falsch, weil alte Läufe die Pipeline blockieren und keine brauchbareren Daten liefern als der neueste Lauf.