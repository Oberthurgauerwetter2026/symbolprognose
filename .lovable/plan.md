## Ziel
Die sichtbaren einzelnen Pixel, kleinen Quadrate und Inseln in den Niederschlagsflächen werden direkt in der Erzeugungs- und Render-Kette entfernt – ohne Crossfade, Blur, Weichzeichnen, Konturglättung oder Änderung der Auflösung.

## Diagnose
- Die serverseitige Morphologie ist bereits eingebaut, aber im Frontend wird für Messungs-PNGs nochmals ein eigenes Canvas-Resampling verwendet.
- Dieses Frontend-Resampling decodiert das PNG zurück in Klassen, macht aktuell eine 3×3-Mittelung und sampled bilinear. Dadurch können neue punktförmige Restflächen bzw. kleine Inseln sichtbar werden, obwohl das PNG selbst bereinigt wurde.
- Zusätzlich kann der Fallback-Canvas für Modellraster weiterhin unreine Einzelzellen zeigen, falls Forecast-PNGs gerade fehlen oder noch nicht neu erzeugt wurden.

## Umsetzung
1. **Serverseitige Bereinigung verstärken, aber konturerhaltend**
   - Die bestehende `scripts/_morph.py`-Logik so erweitern, dass zusammenhängende Niederschlagsflächen nicht nur pro Intensitätsband, sondern auch als Gesamt-Niederschlagsmaske bereinigt werden.
   - Isolierte Gesamtflächen unter einer kleinen Mindestfläche werden auf 0 gesetzt.
   - Danach bleiben die bestehenden bandweisen Regeln für kleine Inseln/Löcher innerhalb der Intensitätsklassen erhalten.

2. **Messungs-Rasterung robuster machen**
   - In `scripts/ingest_radar.py` die Mindestfläche leicht erhöhen, passend zur 240×144-Ausgabe, damit 1–2-Pixel-Cluster sicher verschwinden.
   - Kein Blur, keine Interpolation, keine veränderte Ausgabegröße.

3. **Prognose-Rasterung robuster machen**
   - In `scripts/ingest_openmeteo.py` die Dense-Grid-Bereinigung weiter auf die tatsächliche 48×56-Prognose-PNG-Größe abstimmen.
   - Kleine isolierte Modellzellen werden vor dem Farb-Mapping entfernt, nicht optisch kaschiert.

4. **Frontend als Fehlerquelle entfernen**
   - In `src/components/maps/radar-map.tsx` die 3×3-Mittelung und bilineare Re-Konstruktion der Messungs-PNGs entfernen.
   - Vorgerasterte PNGs werden als harte Klassen/Nearest-Neighbour dargestellt, damit der Browser keine neuen Zwischenwerte oder Sprenkel erzeugt.
   - Falls Canvas-Fallback nötig ist, auch dort keine Mittelung/Crossfade/Blur verwenden.

5. **Verifikation**
   - Lokal prüfen, dass der Morphologie-Filter isolierte Pixel/kleine Quadrate entfernt und zusammenhängende Flächen unverändert lässt.
   - Preview prüfen, ob Messung und Prognose ohne punktförmige Artefakte angezeigt werden.
   - Hinweis: Bereits im Cache liegende R2-PNGs werden erst nach dem nächsten Ingest/Workflow vollständig ersetzt.