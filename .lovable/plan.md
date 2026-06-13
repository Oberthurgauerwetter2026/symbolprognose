
# Wind-Animation (Karte „Wind")

Eine neue, eigenständige Karte unter `/karten/wind`, die genauso aufgebaut ist wie die Radarkarte (gleicher Kartenausschnitt, gleicher Stil, gleiches Modell ICON-CH1), aber **Windböen** (`wind_gusts_10m`) als Prognose-Layer visualisiert. Nur Prognose (kein Messdaten-Strom).

## Was der Nutzer sieht

- Karte (Leaflet, identisch zum Radar: gleicher BBox, gleiche Maske, gleiche Stadt-Marker, Timeline mit Play/Pause + Stunden-Slider).
- **Farb-Layer**: Windböen-Stärke auf 36×22 ICON-CH1-Grid, bilinear interpoliert, weiche Übergänge — blau (schwach) → grün → gelb → orange → rot (stark).
- **Partikel-Flow** (Tracer-Animation): viele langsame Partikel, 50 % Opazität, subtil über dem Farb-Layer.
- **Zoom-Verhalten**:
  - rausgezoomt → mehr Partikel-Dichte sichtbar, keine Pfeile
  - eingezoomt (≥ Zoom 11) → kleine Pfeil-Glyphen auf einem festen Raster zusätzlich (Richtung + Speed-Skalierung)
- **Hover-Tooltip**: Geschwindigkeit (km/h) + Richtung (Grad + 8-Sektor-Kürzel N/NE/E/…) an der Mausposition.
- **Toggle oben rechts** (Popover wie auf der Radarkarte): „Flow · Arrows · Both", Default = Both.
- **Timeline**: Stunden-Frames +0 h … +24 h aus ICON-CH1, weicher Crossfade zwischen Frames, gleicher Player wie Radar.

## Farbskala (Böen, km/h)

```text
  0 – 20    #2b6cb0  blau         schwach
 20 – 40    #38a169  grün         mässig
 40 – 60    #ecc94b  gelb         frisch
 60 – 80    #ed8936  orange       stark
 80 –100    #e53e3e  rot          stürmisch
≥100        #9b2c2c  dunkelrot    Sturm
```

Werte als logarithmisch geglätteter Verlauf zwischen den Bändern (gleicher `colorForSmooth`-Ansatz wie im Radar), damit ICON-Zellen nicht als Blöcke erscheinen.

## Datenpipeline

1. **Ingest** (neu): `scripts/ingest_wind.py` + GitHub-Workflow `wind-ingest.yml`, stündlich getriggert (analog `radar-ingest`).
   - Quelle: Open-Meteo `forecast`-API, Modell `icon_ch1`, Felder `wind_gusts_10m`, `wind_speed_10m`, `wind_direction_10m`, hourly, +0 … +24 h.
   - Grid: gleiches 36×22-Raster wie Radar (BBox 8.15–10.55 E / 46.85–48.30 N, `GRID_LON=36`, `GRID_LAT=22`).
   - Chunked Fetch (≤ 100 Punkte pro Request, wie schon in `ingest_openmeteo.py`).
   - Output: `wind/forecast.json` in R2 mit `{ updatedAt, gridLat, gridLon, frames:[{ t, gust[], speed[], dir[] }] }`.
2. **Server-Function** `src/lib/wind.functions.ts` (`createServerFn` GET): lädt `wind/forecast.json` aus R2 mit kurzem Memory-Cache (5 min), liefert `WindPayload` an den Client. Reuse der vorhandenen R2-Helper aus `openmeteo-cache.server.ts`.
3. **Trigger-Route** `src/routes/api/public/wind/ingest-trigger.ts` analog zu `radar/ingest-trigger.ts` und Aufruf aus `cron-worker` (zusätzlicher Stundenslot).

## Frontend

Neue Komponente `src/components/maps/wind-map.tsx`, strukturell wie `radar-map.tsx`, aber drei Layer:

- **WindColorOverlay** (Canvas, low-res Buffer mit `STEP=2` wie im Radar): bilinear interpoliertes Böen-Feld, Farbe aus Bft-Skala, `opacity 0.55`. Frame-Crossfade per Smoothstep.
- **WindParticleLayer** (Canvas, eigener Pane oberhalb des Farb-Layers):
  - Partikelanzahl skaliert mit Zoom und Pixelfläche (`baseDensity * viewport / 1e6`, ~3000 bei Zoom 9 bis ~1500 bei Zoom 13).
  - Lebenszyklus 60–120 Frames, Reseed an zufälliger Position innerhalb des Viewports.
  - Schrittweite proportional zu `speed`, gedeckelt auf max. 1.5 px/Frame → „lieber viele langsame".
  - Render: weisse Linien, `globalAlpha 0.45`, Trail-Effekt via `fillRect` mit `rgba(0,0,0,0.06)` jedes Frame (Standard-Windy-Trick).
  - `requestAnimationFrame`-Loop, pausiert bei `prefers-reduced-motion` oder Tab-blur.
- **WindArrowLayer** (SVG-Overlay, nur bei Zoom ≥ 11 und Modus ≠ „Flow"): festes Raster (~40 px Abstand), Pfeile mit `rotate(dir)` und Länge nach Speed.
- **Hover-Tooltip**: Leaflet `mousemove` → bilineare Sample-Funktion über `speed`/`dir`, kleines DOM-Popup folgt dem Cursor mit „48 km/h · NW (315°)".
- **Settings-Popover** (gleicher Stil wie Radar): `Switch`-Gruppe „Flow", „Pfeile", „Beides".

## Routing & Konfiguration

- `src/lib/maps-config.ts`: Eintrag `wind` von `coming-soon` → `live`.
- `src/routes/karten.wind.tsx`: ersetzt `ComingSoonMap` durch `<WindMap />` (Loader holt initial Payload via `ensureQueryData`).
- `src/routes/embed.wind.tsx`: bleibt zunächst unverändert, Embed kommt in einem späteren Schritt.

## Was sich NICHT ändert

- Radarkarte, Lokal- und Region-Karte bleiben unangetastet.
- Keine Änderung an `ingest_openmeteo.py` (separate Pipeline, damit der Lokal-Forecast nicht von Wind-Grid-Requests belastet wird).
- Keine Messdaten (Stationen) — bewusst nur Modellprognose, wie gewünscht.

## Technische Details (für später)

- Partikel-Integrator: einfacher Euler-Schritt im Lat/Lon-Raum, Schrittweite `(u, v) * dt`, mit `u = -speed*sin(dir)`, `v = -speed*cos(dir)` (meteorologische Richtung).
- Performance: alle Canvases auf DPR skaliert, kein Layer-Rebuild bei Frame-Wechsel — nur `setFrame()`/`needsRedraw=true`.
- Accessibility: Tooltip-Inhalte werden zusätzlich in eine `aria-live="polite"`-Region geschrieben.
- Telemetrie / SEO: Title „Windprognose Oberthurgau · Animation" + Meta-Description aus `maps-config`.
