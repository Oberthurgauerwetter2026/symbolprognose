## Datenstand-Anzeige einbauen

Ziel: Auf der Startseite und der Karten-Seite wird angezeigt, wann die Wetterdaten zuletzt vom Anbieter aktualisiert wurden.

### Was angezeigt wird

Kleine, dezente Zeile (muted, klein) – z. B.:

> Datenstand: 22.05.2026, 14:00 UTC · Quelle: Open-Meteo (ICON-CH1 / ECMWF / MOSMIX)

Plus Hinweis-Tooltip:
> „Die Modelle werden ca. alle 6 Stunden neu gerechnet (00 / 06 / 12 / 18 UTC). Im Browser werden Daten 30 Min. zwischengespeichert."

### Umsetzung (technisch)

1. **`src/lib/weather.ts`** – `fetchForecast` so erweitern, dass das `generationtime`-Feld bzw. `current.time` / Modell-Run-Zeit aus der Open-Meteo-Antwort mitgegeben wird. Open-Meteo liefert `generationtime_ms` und je nach Endpoint `current.time`; als „Modell-Run" verwenden wir die jüngste verfügbare Stunde aus `hourly.time[0]` (UTC) als Approximation für den Datenstand.
2. **`src/components/weather-widget.tsx`** – unter dem Hauptwert eine `<p class="text-xs text-muted-foreground">` mit Datenstand + Tooltip einfügen.
3. **`src/components/region-map.tsx`** – am Karten-Header (oben rechts oder unter dem Titel) dieselbe Datenstand-Zeile rendern, basierend auf der ersten erfolgreichen Spot-Query.
4. Formatierung über `Intl.DateTimeFormat('de-CH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' })`.

Keine neuen Dateien, keine Backend-Änderungen.

### Nicht enthalten

- Kein eigener Server-Cron, kein erzwungenes Refresh (TanStack-Query-`staleTime` bleibt 30 Min.).
- Keine separate Anzeige je Modell – ein gemeinsamer Stand reicht.
