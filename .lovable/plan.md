## Ziel

Die "fleckenartigen" ICON-CH1-Prognosegebiete in der Radar-Prognose visuell glätten, ohne die Messung (CombiPrecip-PNG) oder die Skala zu verändern.

## Änderungen (nur `src/components/maps/radar-map.tsx`, Prognose-Pfad)

Alles greift nur, wenn `contour === true` (also Frames mit `source !== "radar"`). Messung bleibt unverändert.

1. **Weicher Alpha-Ramp unter dem ersten Band**
   - Aktuell: `if (v < 0.1) continue;` → harte Kante.
   - Neu für Prognose: ab `v >= 0.03` zeichnen; zwischen `0.03` und `0.1` Alpha linear von 0 → 235 hochfahren (Farbe = Band 1, `[150,195,235]`). Ab `0.1` läuft alles wie heute über `colorForSmooth`.
   - Effekt: einzelne Modellzellen verschmelzen mit Nachbarn statt als isolierte Punkte zu erscheinen.

2. **`colorForSmooth` auch für Prognose verwenden**
   - Aufruf in Zeile 485 ändern: bei `contour` weiter Skala-Bänder, aber log-interpoliert (`colorForSmooth`) statt quantisiert (`colorFor`). Verhindert die Cartoon-Sprünge zwischen Band 1 und Band 2.

3. **Leichter Gaussian-Blur des Off-Screen-Buffers (nur Prognose)**
   - Vor `ctx.drawImage(off, …)`: bei `contour` `ctx.filter = "blur(1.2px)"` setzen, danach zurück auf `"none"`.
   - Glättet Restkanten der ~2-km-Modellzellen, ohne die Iso-Bänder zu verwischen.

4. **CSS-Filter anpassen (Zeile 367)**
   - Für `contour` heute: `"contrast(1.4)"`. Neu: `"contrast(1.15)"`, damit der weichere Verlauf nicht durch hohen Kontrast wieder hart wird. Messung-Pfad (`"blur(0.8px) contrast(2.2)"`) bleibt unverändert.

## Nicht geändert

- `SCALE`-Schwellen und Farben (bleiben identisch zu `ingest_radar.py`).
- Messung-Render (PNG-Overlay + Fallback-Canvas mit `colorForSmooth`).
- Datenpipeline, Server-Functions, Caching.

## Verifikation

Nach Build: Route `/karten/radar`, Prognose-Frame (>0 min) öffnen und prüfen, dass
- konvektive Zellen weichere Ränder haben, keine isolierten 1-Pixel-Dots mehr,
- die Iso-Bänder weiterhin erkennbar bleiben (kein "Matsch"),
- der Messung-Frame (t ≤ jetzt) visuell unverändert ist.
