# Radar: Messung zeigt keine Daten

## Befund (geprüft)

- Der Radar-Ingest läuft einwandfrei: die letzten zehn GitHub-Läufe (alle 5 Minuten, bis 16:15 UTC) sind erfolgreich.
- Der Grund liegt bei der Datenquelle: MeteoSchweiz OGD (Collection `ch.meteoschweiz.ogd-radar-precip`, Tages-Item `20260812-ch`) enthält als jüngstes Bild **09:30 UTC**. Seit rund sieben Stunden veröffentlicht MeteoSchweiz keine neuen Radarbilder mehr. Das Ingest-Protokoll bestätigt das: „all older than since … using newest 6 available frames".
- Warum dadurch **gar nichts** sichtbar ist: `src/lib/radar.functions.ts` verwirft Messframes älter als 6 Stunden (`pastCutoff = now - 6h`). Da das jüngste Bild älter ist, fallen alle Messframes weg — die Karte zeigt statt einer alten Messung nichts.

Das ist also kein Fehler in der App, aber die Reaktion auf den Quellenausfall ist unnötig hart.

## Umsetzung

1. **Letzte verfügbare Messung nie ganz wegfallen lassen**: Zusätzlich zum 6-Stunden-Fenster werden immer die jüngsten Messframes (bis zu 12 Stück) behalten, auch wenn sie älter sind. Der Filmstrip zeigt dann die letzte echte Messung statt einer Lücke.
2. **Klarer Hinweis statt stiller Lücke**: Ist die jüngste Messung älter als 30 Minuten, erscheint in der Radarkarte ein gut sichtbarer Hinweis mit Uhrzeit und Ursache, z. B. „Radarmessung von MeteoSchweiz seit 11:30 nicht aktualisiert – Quellenausfall". Die bestehende, technisch formulierte Warnung wird durch diesen Text ersetzt.
3. **Prognose bleibt unberührt**: Der ICON-CH1/ICON-seamless-Teil der Karte läuft unverändert weiter, Blitze und Hagel ebenfalls.

## Technische Details

- `src/lib/radar.functions.ts`: `pastCutoff`-Filter um einen Fallback ergänzen (jüngste bis zu 12 Manifest-Frames immer aufnehmen, unabhängig vom Alter); Warntext im Staleness-Block (aktuell „Messung seit X min nicht aktualisiert") auf Uhrzeit + Quellenhinweis umstellen.
- `src/components/maps/radar-map.tsx`: Warnhinweis als bestehende Info-/Status-Pille ausgeben, damit er in Karte und Embed sichtbar ist.
- Keine Änderung an Ingest-Skripten, Workflows, R2-Pfaden oder Farbskalen.

## Hinweis

Sobald MeteoSchweiz wieder publiziert, holt der 5-Minuten-Ingest automatisch alle fehlenden Bilder nach; ein manueller Eingriff ist nicht nötig.
