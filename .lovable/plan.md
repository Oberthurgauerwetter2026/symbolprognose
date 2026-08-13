# Radar-Prognose: Blöcke endgültig ausschliessen

## Es täuscht nicht — an den Live-Daten geprüft

- Das aktuelle Prognose-Manifest (`radar/forecast-frames.json`, erzeugt 13.08. 18:58 UTC) enthält **134 Frames, alle `source: "icon-ch1"` mit PNG** — Zeitraum 13.08. 18:00 UTC bis **15.08. 03:15 UTC**.
- Für den Zeitpunkt im Screenshot (Sa 15:00 lokal = 15.08. 13:00 UTC) existiert **kein PNG**. Ein Test-Abruf des erwarteten Bildes liefert kein Bild.
- Die im letzten Schritt eingebaute Stunden-Rasterung (`rasterize_forecast_hourly_pngs`) hat also im letzten Lauf **keine Frames geschrieben** (übersprungen oder fehlgeschlagen) — im Manifest fehlt jeder Stunden-Eintrag.
- Folge: `src/lib/radar.functions.ts` hängt für diese Zeitpunkte weiter Grid-Frames ohne `precipUrl` an (Sparse-Grid ~12 km), und die Karte rendert sie als weiche, aber sichtbar kantige Kästen. Genau das ist im Bild zu sehen.

Warum die Stunden-PNGs ausblieben, ist noch nicht bewiesen (Ingest-Log liegt hier nicht vor) — die wahrscheinlichen Ursachen sind ein Skip-Zweig (fehlende/verschobene `phase2`-Daten, Gitter-Mismatch) oder ein Upload-Fehler. Das wird als erster Schritt sichtbar gemacht statt geraten.

## Änderungen

1. **Ursache sichtbar machen (`scripts/ingest_openmeteo.py`)**
   - Die Stunden-Rasterung protokolliert klar: Anzahl `phase2`-Punkte, Gittergrösse, erster/letzter Stundenslot, Anzahl geschriebener PNGs, jeder Skip-Grund mit Begründung.
   - Fehler beim Rastern/Upload werden nicht mehr still verschluckt: Ausnahme mit Traceback loggen und den Lauf als teilweise fehlgeschlagen markieren.
   - Robustheit: Stundenslots werden auch dann erzeugt, wenn `phase2` auf einem anderen Punktgitter liegt als erwartet (Gitterachsen aus den tatsächlich vorhandenen Punkten ableiten statt bei Mismatch abzubrechen), und der Startzeitpunkt richtet sich am letzten CH1-Slot aus, auch wenn dieser fehlt.
   - Ergebnis sichtbar im Manifest: Stundenframes mit `source: "icon-seamless"` und `precipUrl` bis +48 h.

2. **Harte Garantie im Frontend: kein Grid-Rendern in der Radar-Prognose**
   - `src/lib/radar.functions.ts`: Frames ohne `precipUrl` werden nicht mehr in die Radar-Timeline aufgenommen. Die Stundenwerte bleiben als Werte-Anhang für die Niederschlagssummen erhalten (separater, unveränderter Pfad der Summenkarte).
   - `src/components/maps/radar-map.tsx`: Der Grid-Renderpfad im `PrecipOverlay` wird für Prognoseframes vollständig deaktiviert (Bild oder nichts). Fehlt ein PNG, endet die Prognose-Timeline schlicht früher, statt Kästen zu zeigen.
   - Kommentar-Guard an beiden Stellen bleibt/wird geschärft: „Radar-Prognose nie aus dem Sparse-Grid rendern."

3. **Kontrolle nach dem Lauf**
   - Nach der Umsetzung Ingest anstossen und das Manifest prüfen: Frames bis +48 h, alle mit `precipUrl`, PNG-Grösse 240 × 144 wie die Messung.

## Wirkung

Die Prognose zeigt entweder Bilder im Messraster (glatte Bandkanten wie die Messung) oder für nicht vorhandene Zeitpunkte nichts — Blöcke sind konstruktiv nicht mehr möglich, auch bei künftigen Ingest-Ausfällen.

## Nicht enthalten

Keine Änderung an Farbskala, Deckkraft, Timeline-Kadenz, Crossfade/Morphing, Blitz-Layer oder Summenkarte.
