# Gewitter-Autowarnung: auf MeteoSchweiz-Logik trimmen

## Stand (geprüft im Code)

Die letzte Runde ist umgesetzt: `THUNDER_RAIN_MMH = [25, 50, 80]`, Fläche `MIN_CELL_PIXELS = 8` im Radar-Ingest (`v26-area8`), und in `auto-thunder.server.ts` gibt es die Bestätigung durch zwei Läufe (15-Minuten-Fenster) für neue Warnungen und Höherstufungen.

Trotzdem wirkt die Automatik zu aggressiv — der Grund liegt nicht an der mm/h-Zahl allein, sondern daran, dass wir bereits **Stufe 1** automatisch als Warnung publizieren und pushen. MeteoSchweiz macht das nicht: Gewitter werden erst ab **Stufe 2 (mässige Gefahr)** gewarnt, und die Beurteilung stützt sich auf Fläche, Dauer und mehrere Kriterien (Regen, Böen, Hagel) statt auf eine 5-Minuten-Radarspitze. SRF Meteo übernimmt diese MeteoSchweiz-Warnstufen.

## Ziel

Die Automatik verhält sich wie eine MeteoSchweiz-Gewitterwarnung: selten, flächig belegt, zeitlich bestätigt — und keine Push-Flut bei jeder kräftigen Zelle.

## Änderungen

1. **Keine automatische Stufe 1 mehr**
   - Automatische Warnungen entstehen nur ab Stufe 2.
   - Zellen, die nur Stufe-1-Werte erreichen, erzeugen entweder nichts oder — falls gewünscht — eine stille „Vorinformation“ ohne Push (Vorschlag: zunächst nichts, das ist am nächsten an MeteoSchweiz).

2. **Stufen an MeteoSchweiz angleichen**
   - Stufe 2 ab 30 mm/h, Stufe 3 ab 50 mm/h (MeteoSchweiz-Bereiche für kräftige bzw. schwere Gewitter).
   - Stufe 1 bleibt als Wert in der Konfiguration für manuelle Warnungen erhalten, wird aber von der Automatik nicht mehr benutzt.

3. **Fläche statt Pixelspitze**
   - `MIN_CELL_PIXELS` von 8 auf 12 (~12 km² über der Schwelle) im Radar-Ingest; neue Ingest-Version, damit alte Werte nicht weiterwirken.
   - Warntext nennt weiterhin die Spitzenintensität, die Stufe entscheidet ausschliesslich die Flächenintensität.

4. **Länger bestätigen**
   - Stufe 2 braucht zwei Läufe in Folge (wie heute), Stufe 3 drei Läufe (~15 Min.) — verhindert Hochstufung durch einen einzelnen Radarblitz.
   - Bestätigungsfenster bleibt 15 Minuten.

5. **Push-Ruhe**
   - Wiederholsperre pro Region von 45 auf 60 Minuten; Höherstufung pusht weiterhin sofort.
   - Rückstufung innerhalb einer laufenden Warnung löst keinen Push aus (ist heute schon so, wird dokumentiert).

6. **Admin-Tool**
   - Hinweistexte in `admin-warnungen.tsx` auf die neue Logik aktualisieren: „Automatik warnt erst ab Stufe 2 (ab 30 mm/h über mind. 12 km², bestätigt durch zwei Radarläufe)“.

## Technische Details

- `src/lib/warnings-config.ts`: `THUNDER_RAIN_MMH` → `[15, 30, 50]` (Stufe 1 nur für manuelle Warnungen), Kommentar zur MeteoSchweiz-Herkunft.
- `src/lib/auto-thunder.server.ts`: `AUTO_MIN_LEVEL = 2`; `levelFor()` liefert 0 unter Stufe 2; Bestätigungszähler pro Region im Kandidaten-JSON (`{ level, t, n }`) statt nur `{ level, t }`; `RENOTIFY_MS` auf 60 Min.
- `scripts/ingest_radar.py`: `MIN_CELL_PIXELS = 12`, `RADAR_INGEST_VERSION = "v27-area12"`; passender Workflow-Wert.
- `src/routes/admin-warnungen.tsx`: Beschreibungstexte der Schwellen.

## Offen

Falls dir Stufe-2-Einstieg bei 30 mm/h noch zu tief ist, kann derselbe Umbau auch mit 35 mm/h starten — sag einfach, welche Zahl du willst.
