# Radar-Prognose: Blöcke dauerhaft beseitigen

## Befund (im Code geprüft)

Die Blöcke stammen nicht vom Prognose-PNG-Pfad — dort wird weiterhin glatt hochgerastert (`_upsample_smooth`, `scripts/ingest_openmeteo.py:283/355`, Zielraster 240×144 wie die Messung).

Sie entstehen im **zweiten** Prognoseabschnitt: Sobald das ICON-CH1-Fenster (15-min-Felder mit PNGs) endet, hängt `src/lib/radar.functions.ts` (Zeilen 528–569) Stundenframes aus ICON-CH2 an — **ohne** `precipUrl`, nur mit `values` auf dem Open-Meteo-Sparse-Grid (`GRID_LAT/GRID_LON`, ca. 22×36 → ~12 km pro Punkt). Diese Frames rendert das Frontend über `PrecipOverlay` mit bilinearer Interpolation über dieses grobe Gitter. Bilinear zwischen 12-km-Punkten ergibt genau die rechteckigen Kästen im Screenshot (Prognose Sa 16:00 liegt hinter dem CH1-Fenster).

## Änderungen

1. **Prognose-PNGs auch für den Stundenbereich erzeugen** (`scripts/ingest_openmeteo.py`)
   - Der bestehende PNG-Renderer wird zusätzlich mit den Stundenwerten (ICON-CH2 / seamless) auf dem Dense-Grid gefüttert und schreibt für jeden Stundenslot bis +48 h ein PNG im gleichen 240×144-Raster, gleicher BBox, gleicher Farbskala, gleiche `clean_precip_field`-Bereinigung wie heute.
   - Diese Frames landen im gleichen `radar/forecast-frames.json`-Manifest (mit `source`), damit das Frontend sie über den identischen PNG-Pfad rendert wie Messung und CH1-Prognose.

2. **Grid-Frames nicht mehr blockig rendern** (Sicherheitsnetz, `src/lib/radar.functions.ts` + `src/components/maps/radar-map.tsx`)
   - CH2-Stundenframes werden nur noch als reine Wertelieferung für die Summenkarte behandelt; existiert für denselben Zeitpunkt ein PNG, gewinnt das PNG.
   - Bleibt (bei Ingest-Ausfall) doch nur der Grid-Pfad, wird im `PrecipOverlay` statt bilinear eine Catmull-Rom-Interpolation (bikubisch, gleiche Bandschwellen) verwendet, damit auch dann keine Rechteckkanten entstehen.

3. **Nachhaltigkeit**
   - Kommentar-Guard an beiden Stellen: „Prognose nie aus dem Sparse-Grid blockig rendern" — plus Memory-Eintrag (Constraint), damit die blockige Darstellung nicht wieder eingeführt wird.

## Wirkung

Nach dem nächsten Ingest-Lauf sieht die gesamte Prognose (15-min- und Stundenbereich) strukturell identisch zur Messung aus: gleiche Bandkanten, organische Konturen, keine Rechteckblöcke. Physikalisch bleibt der Stundenbereich ein gröberes Modellfeld — er wird aber nicht mehr als Gitterkästen dargestellt.

## Nicht enthalten

- Keine Änderung an Farbskala, Deckkraft, Timeline-Kadenz, Crossfade oder Blitz-Layer.
- Keine zusätzlichen Open-Meteo-Requests: die Stundenwerte werden bereits abgefragt.
