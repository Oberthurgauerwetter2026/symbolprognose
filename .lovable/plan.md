## Diagnose

Im Radar-/Vorhersage-Layout der Karte `/karten/radar` werden mehrere Layer über das Niederschlags-Canvas gelegt:

```
TileLayer (swisstopo)
PrecipOverlay (Canvas, opacity 0.7)
OUTSIDE_CH_MASK   (Grau, fillOpacity 0.4)   ← dimmt alles ausserhalb der Schweiz
SWITZERLAND       (weisse Outline)
THURGAU           (Outline)
OUTSIDE_MASK      (Grau, fillOpacity 0.18)  ← dimmt alles ausserhalb der Region
LAKE              (fillOpacity 1.0)         ← überdeckt Niederschlag auf dem See KOMPLETT
```

Effekte daraus:
- Der Bodensee wird vom Lake-Polygon vollflächig blau übermalt. Was im Screenshot wie „Regen über dem See" wirkt, ist effektiv der See-Fill, nicht das ICON-CH1-Signal.
- Ausserhalb des Kantons Thurgau liegen zwei graue Masken (∑ ~0.5 Effektivopacity) über dem Canvas → ICON-CH1 wirkt dort verwaschen oder verschwindet ganz.
- Zusätzlich rendert das Canvas selbst mit `opacity: 0.7` und die Farbskala startet bei `alpha 0.55` → effektiv nur ~0.38 Pixelopacity bei leichtem Regen.

Datenseitig deckt das Grid bereits die Bbox 47.30–47.85 / 8.85–9.85 ab, also praktisch den ganzen Karten-Viewport (`maxBoundsExt` 47.25–47.90 / 8.78–9.92). Es muss nichts neu geholt werden – nur das Rendering anpassen.

## Plan

Reine Frontend-Änderungen in `src/components/maps/radar-map.tsx`:

1. **Render-Reihenfolge so umstellen, dass der Niederschlag oben liegt**
   - Reihenfolge im JSX: TileLayer → OUTSIDE_CH_MASK → OUTSIDE_MASK → LAKE → SWITZERLAND-Outline → THURGAU-Outline → **PrecipOverlay / ImageOverlay** → Städte-Marker → ZoomControl.
   - Damit überdecken Masken und See den Niederschlag nicht mehr.

2. **Lake nicht mehr volldeckend**
   - `fillOpacity` von `1` auf `0` (nur Outline `#6bb6d6`, weight ~0.8) oder ganz ohne Fill, damit ICON-CH1-Werte über dem Bodensee sichtbar bleiben. Outline bleibt für Orientierung.

3. **Aussen-Masken dezenter**
   - `OUTSIDE_CH_MASK.fillOpacity` 0.4 → 0.15
   - `OUTSIDE_MASK.fillOpacity` 0.18 → 0.05 (oder ganz entfernen, da die Region-Outline reicht).
   - Ziel: Region bleibt visuell betont, dimmt das Wetter aber nicht mehr.

4. **Kontrast des Canvas-Overlays erhöhen** (`PrecipOverlay`)
   - Canvas-`opacity` 0.7 → 0.9.
   - In `colorFor()` Alpha-Kurve anheben: Start 0.7 statt 0.55, Max 0.95 statt 0.9.
   - Farbskala leicht satter machen, vor allem im unteren Bereich (0.1–2 mm/h), damit schwache Signale klar lesbar werden: tieferes Blau für 0.1–0.7 (z. B. `[140,190,240]` → `[110,170,235]`), Mittelwerte (2–10 mm/h) unverändert.
   - Beim Bilinear-Sampling den `STEP` von 3 auf 2 CSS-px reduzieren, damit die schwachen Werte nicht zu „blockig" aussehen.

5. **ImageOverlay (echte MeteoSchweiz-PNGs) ebenfalls oben**
   - Gleicher Z-Order-Move; `opacity` 0.75 → 0.9 für stärkeren Kontrast.

6. **Keine Änderungen** an:
   - `radar.functions.ts` (Datenpfad, Bbox, Cache).
   - Open-Meteo-Budget / Cron / phaseA-Trennung.
   - Legende/Skala-Reihenfolge.

## Technische Notizen

- Leaflet rendert `ImageOverlay` und der Canvas-Custom-Layer hängt am `overlayPane`. GeoJSON-`Polygon` ebenfalls. Reihenfolge im React-Tree bestimmt die DOM-Reihenfolge im Pane → Umsortieren reicht.
- Für noch sauberere Trennung könnten Masken auf einen eigenen Pane mit niedrigerem `zIndex` gelegt werden (`map.createPane`), aber das ist nicht nötig, solange die JSX-Reihenfolge passt.
- QA: Vorher/Nachher-Screenshot bei einem Forecast-Slot mit aktivem Regen prüfen (Bodensee + Hinterland sollten beide eingefärbt sein, ohne dass die Karte ihre Orientierung verliert).

## Out of Scope

- Bbox/Grid vergrössern (aktuell nicht nötig, Karte ist bereits abgedeckt).
- Änderungen am Symbolprognose-Workflow oder am 5-Min-Cron.
- Neue Farblegende/UI-Texte.