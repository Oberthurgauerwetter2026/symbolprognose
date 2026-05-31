## Plan

**Ziel:** Auto-Refresh nur stündlich; Karten-Darstellung wie im Screenshot (Kachelmann-Style: echte Basiskarte mit Ortsnamen, flache Farbbänder, mm-Zahlen über der Fläche, kräftige Grenzen).

### 1. Refresh-Intervall

In `src/routes/intern.niederschlag.tsx`:
- `refetchInterval` von `5 * 60_000` auf `60 * 60_000` setzen.
- `staleTime` auf `30 * 60_000` anheben (kein unnötiger Re-Fetch beim Tabwechsel).

### 2. Karte komplett auf Leaflet-Basis umstellen (analog Radar-Prognose)

`src/components/maps/precip-accum-map.tsx` wird umgebaut von „reines Canvas mit weißem Hintergrund" auf das gleiche Leaflet-Setup wie `radar-map.tsx`:

- `MapContainer` mit Center `[47.575, 9.35]`, Zoom `9.5`, fester `maxBounds`, deaktiviertes Scroll-Zoom-Hinweis-Verhalten (rein zur Anzeige).
- `TileLayer` mit swisstopo „leichte-basiskarte_reliefschattierung" → liefert die OSM-artige Grundkarte mit Ortsnamen, Seen, Straßen wie im Screenshot.
- `GeoJSON`-Overlays: Schweiz-Grenze (weiß), Thurgau (kräftig dunkelblau, fett), Bodensee.
- Heatmap weiterhin als `ImageOverlay`: das bisherige Offscreen-Canvas rendert nur die akkumulierten Niederschlags-Bänder (transparent, ohne Hintergrund) und wird per `toDataURL` als Overlay über die Karte gelegt — gleiche Technik wie `PrecipOverlay` im Radar.

### 3. Farben & Banderung wie im Screenshot

- Klassengrenzen behalten (0.3/1/2/5/10/20/30/50/75/100 mm), aber Farben enger an die Kachelmann-/MeteoSchweiz-Palette des Screenshots ausrichten: hellblau → mittelblau → dunkelblau → grün → gelb → orange → rot → magenta.
- Volle Deckkraft (`alpha ~ 0.85`), keine Interpolation zwischen Klassen — harte Bandkanten.
- Kein Blur.

### 4. mm-Zahlen auf den Bändern

Im Heatmap-Canvas zusätzlich zur Farbfläche numerische Labels rendern (wie „5", „10", „20", „30" im Screenshot):
- Über das Grid in regelmäßigen Pixelabständen (~110 px) gehen.
- Wenn die Akkumulation an dieser Position ≥ Schwellenwert eines Bandes ist, den größten überschrittenen Klassen-Schwellenwert (gerundet) als kleines Label mit weißem Halo zeichnen.
- Resultat: gut verteilte mm-Zahlen über die Karte, ohne echte Iso-Konturen rechnen zu müssen.

### 5. SPOTS-Punkte

Spot-Pills entfernen (Basemap liefert bereits Ortsnamen). Stattdessen nur kleine Punkte ohne Label für die Kernorte (Amriswil, Romanshorn, Bischofszell), damit die Region erkennbar bleibt.

### 6. PNG-Download

Bleibt funktional wie zuletzt (neuer Tab + Speichern-Button). Export-PNG wird weiterhin in einem standalone 1280×760 Canvas erzeugt: heller Hintergrund + Heatmap + Konturlabels + Thurgau-Outline + Legende. Die Basemap-Tiles werden im Export nicht eingebettet (Tile-Server-Lizenz/CORS), dafür wird im Export-Canvas die bisherige helle Grundkarte verwendet — das ist die robusteste, sandbox-sichere Variante.

### Technische Details

- Neue Hilfsfunktion `renderHeatmapToDataUrl(payload, bbox, w, h)` rendert nur Heatmap + mm-Labels mit transparentem Hintergrund → `ImageOverlay` `url`.
- Für `bounds` der `ImageOverlay` der gleiche `VIEW_BBOX` wie heute (etwas breiter zurücksetzen auf ca. `47.35–47.80 / 8.85–9.75`, damit die Basemap nicht abgeschnitten wirkt).
- Map-Höhe ca. 560 px, responsiv volle Breite der Card.
- Keine Änderungen an Auth, Datenquellen oder Server-Code.