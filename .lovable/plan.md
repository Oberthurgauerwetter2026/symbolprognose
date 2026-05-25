# Radar-Animation (Karten/Radar)

## Hinweis zur Datenquelle

Open-Meteo betreibt **keine eigene Radar-Tile-API** (wie RainViewer das tut). Es liefert aber **rasterbasierte Niederschlags-Punktdaten**:

- **Vergangenheit (bis −24 h)**: `minutely_15.precipitation` — basiert auf gemerged Radar-Nowcast-Daten (kommt indirekt aus europäischen Radarnetzen inkl. MeteoSchweiz/DWD). Auflösung 15 min.
- **Gegenwart → +33 h**: `models=icon_ch1` mit `minutely_15.precipitation` oder `hourly.precipitation`.
- **+33 h → +120 h**: `models=icon_ch2` mit `hourly.precipitation`.

Daraus lässt sich für den Oberthurgau-Ausschnitt eine **animierte Heatmap-Überlagerung** auf der Leaflet-Karte aufbauen — kein „echtes" Radarbild, aber visuell ähnlich (farbcodierter Niederschlag pro Pixel, animiert über die Zeit). Das ist die einzig saubere Lösung allein mit Open-Meteo und ohne externen Renderer.

Falls später echte Radar-Tiles gewünscht sind, ist RainViewer der einfachste Drop-in (kann nachgereicht werden, ohne dass die UI sich ändert).

## Was gebaut wird

Eine neue Karte `/karten/radar` (und `/embed/radar`) mit:

1. **Leaflet-Karte** im gleichen Region-Oberthurgau-Stil wie die anderen Karten (Maske, See, Region-Outline).
2. **Niederschlags-Heatmap-Overlay** als animiertes Canvas, das sich pro Zeitschritt neu rendert.
3. **Zeit-Steuerung** unten:
   - Slider von **−12 h** bis **+120 h** (in 15-min-Schritten für −12 h…+33 h, in 1-h-Schritten ab +33 h)
   - Play/Pause, Geschwindigkeit (1×/2×/4×)
   - Aktueller Zeitstempel + Badge: **„Messung"** (Vergangenheit, Nowcast) / **„ICON-CH1"** (≤ +33 h) / **„ICON-CH2"** (> +33 h)
   - „Jetzt"-Button springt zum aktuellen Zeitpunkt
4. **Startpunkt beim Öffnen = aktuelle Uhrzeit** (Slider auf t = 0).
5. **Legende** mit Niederschlagsklassen (mm/h: 0.1, 0.5, 1, 2, 5, 10, 20, 50).
6. **Hagel/Blitze**: vorerst nicht implementiert (Platzhalter-Toggle in der Legende, „Bald verfügbar").

## Technische Umsetzung

### Datenfetch (Server-Funktion)

Datei: `src/lib/radar.functions.ts`

- `getRadarFrames` (`createServerFn`, GET, gecached über TanStack Query).
- Holt **ein Grid** von ca. **24×16 = 384 Punkten** über die Bounding-Box Oberthurgau (≈ 9.0–9.7° E, 47.45–47.75° N, ~3 km Raster).
- 1 HTTP-Call pro Punkt ist zuviel — stattdessen **Open-Meteo Multi-Location-Format** (`latitude=47.5,47.55,…&longitude=9.1,9.15,…`), das in einer Antwort alle Punkte liefert. Es wird in 2 Calls aufgeteilt:
  1. **Vergangenheit + Nowcast**: `past_days=1`, `forecast_minutely_15=192` (=48 h), `minutely_15=precipitation`, ohne `models` (Open-Meteo wählt Best-Match inkl. Radar).
  2. **Modell-Vorhersage**: `models=icon_seamless` mit `hourly=precipitation`, `forecast_days=6`. (icon_seamless = automatisches ICON-CH1 für die ersten 33h, dann ICON-CH2; das macht die Quellenangabe sauber.)
- Rückgabe: `{ bbox, gridLat[], gridLon[], frames: [{ t: ISO, source: 'radar'|'icon-ch1'|'icon-ch2', values: number[] }] }`.
- Server-Cache via Response-Header `Cache-Control: public, max-age=600` (Radar-Daten aktualisieren ca. alle 5 min).

### Frontend-Komponente

Datei: `src/components/maps/radar-map.tsx`

- Wiederverwendung des Layouts aus `region-map.tsx` (Tiles, Maske, GeoJSON).
- **Custom Leaflet-Layer** (`L.Layer` Subclass mit Canvas-Overlay), der pro Frame:
  - das Grid auf Pixelkoordinaten projiziert
  - eine bilineare Interpolation zwischen den Grid-Punkten zeichnet
  - Farbskala anwendet (Niederschlags-Klassen wie oben)
- **Animations-Loop** über `requestAnimationFrame` mit konfigurierbarer FPS.
- Frames werden vorab fetched (TanStack Query, `staleTime: 5 min`), während Animation läuft → flüssig.

### Routen

- `src/routes/karten.radar.tsx` ersetzt den jetzigen `ComingSoonMap`-Stub.
- `src/routes/embed.radar.tsx` ersetzt analog.
- Status in `src/lib/maps-config.ts` für `radar` von `coming-soon` auf `live` setzen.

### UI-Komponenten

- `src/components/maps/radar-timeline.tsx` — Slider + Play/Pause + Quelle-Badge + „Jetzt"-Button.
- `src/components/maps/radar-legend.tsx` — Farbskala mit mm/h-Werten, Toggle-Platzhalter „Blitze / Hagel (bald)".

## Was außerhalb dieses Plans bleibt

- Blitze (Blitzortung.org) und Hagel-Layer (POH/MESHS) — als „bald"-Toggle sichtbar, aber nicht funktional.
- Echte Radar-Reflektivitäts-Bilder (würden externe Tile-Quelle/Renderer erfordern).
- Persistenz von Nutzer-Einstellungen (Geschwindigkeit etc.).

## Geschätzter Umfang

5 neue/geänderte Dateien, ein Server-Function-Call alle 10 Min pro Nutzer, kein neuer Secret/API-Key nötig (Open-Meteo ist frei).
