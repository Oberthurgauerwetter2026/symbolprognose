## Ziel

Die Karte visuell an die hochgeladene Vorlage angleichen: dunkler Hintergrund ausserhalb der Region, hellblauer Bodensee, sattes Grün für das Land, und Wetter-Marker als blaue, abgerundete Pill-Labels mit Symbol und Min-/Max-Temperatur (Tageswerte).

Nur `src/components/region-map.tsx` und `src/lib/weather.ts` werden angepasst. GeoJSON, Routen und 4 Spots bleiben.

## Änderungen

**1. Basemap → flacher, farbiger Look (wie Vorlage)**

- Esri-Tiles entfernen. Statt Bitmap-Tiles eine reine Vektor-/CSS-Darstellung:
  - `MapContainer` Hintergrund: `#1f2a36` (dunkles Schiefer-Blau → ausserhalb der Region).
  - Land-Layer: zusätzliches GeoJSON-Polygon des **Kantons Thurgau** (oder ersatzweise die Vereinigung der vier Gemeindeflächen, erweitert um eine grosszügige Bounding-Hülle) in `fill: #8fbf7f` (sattes Hellgrün), `stroke: none`.
  - See-Layer: GeoJSON-Polygon **Bodensee** (Untersee + Obersee-Westteil) in `fill: #7ec8e3` (helles Wasserblau), darüber gezeichnet.
- Mask-Polygon entfernen (nicht mehr nötig, da kein Tile-Hintergrund mehr).
- Neue Datendateien:
  - `src/data/land.json` — vereinfachtes Polygon der Landfläche im Kartenausschnitt (Quelle: bestehendes `region.json` + Erweiterung, oder Natural-Earth-Auszug; ich generiere ein vereinfachtes GeoJSON von Hand aus den Region-Bounds + manueller Seeufer-Linie).
  - `src/data/lake.json` — vereinfachtes Polygon Bodensee im Ausschnitt.

**2. Region-Outline**

- Bezirksgrenze als dünne, helle Linie (`#ffffff`, `weight: 1.5`, `opacity: 0.4`) — dezent wie in der Vorlage.

**3. Marker als blaue Pill-Labels (zentrales Element)**

- Form: horizontal, abgerundet (`border-radius: 14px`), zweispaltig:
  - Links: Wetter-Icon (gelbe Sonne / Wolke, vorhandene `WeatherIcon`-Komponente), grösser dargestellt mit weissem Kreis-Hintergrund.
  - Rechts: oben Ortsname (weiss, fett, ~13px), darunter zwei Temperatur-Badges nebeneinander (Min hellblau `#bcd8ec`, Max sattblau `#1e4a82`, weisser Text, ~11px) — exakt wie in der Vorlage.
- Hintergrund-Pill: `#1f4a7a` (kräftiges Royal-Blau), Schatten `0 4px 12px rgba(0,0,0,0.25)`.
- Wind-Anzeige entfernen (Vorlage zeigt nur Min/Max). Optional: Hover-Tooltip für Wind später.

**4. Wetterdaten: Min/Max statt aktueller Stundenwert**

- `fetchForecast` in `src/lib/weather.ts` zusätzlich um `daily: { time, temperature_2m_min, temperature_2m_max, weathercode }` erweitern (Open-Meteo-Parameter `daily=temperature_2m_max,temperature_2m_min,weathercode`).
- `SpotMarker` liest Index `0` (heute) aus `daily`, zeigt Min/Max + Tages-Weathercode.
- Stunden-Refresh bleibt (für Wechsel um Mitternacht reicht der bestehende 60s-Interval-Hook; Query-Key bekommt zusätzlich das Datum).

**5. Container**

- `rounded-2xl`, `shadow-lg`, `bg-[#1f2a36]` (dunkler Hintergrund bleibt auch sichtbar während Tile-Loading entfernt ist).
- Höhe bleibt `600px`.

## Technische Details

- Polygone für Land/See: ich generiere sie aus OpenStreetMap-Overpass-Daten (Relation Kanton Thurgau, Relation Bodensee), vereinfacht auf ~200 Punkte mit `mapshaper` oder von Hand erstellt — falls Overpass nicht erreichbar, alternativ Natural-Earth-Auszug (`ne_10m_lakes`, Kantonsgrenze aus swissBOUNDARIES3D vereinfacht). Da das im Build-Step nicht laufen kann, **lade ich die GeoJSONs einmalig via `curl` aus dem Overpass-API herunter und speichere sie statisch** unter `src/data/`.
- Leaflet rendert SVG-Polygone scharf; kein Tile-Layer mehr.
- `WeatherIcon` muss eine helle Variante auf farbigem Pill-Hintergrund vertragen — vorhandene Icons sind farbig, also auf weissem Inner-Kreis platzieren.

## Nicht verändert

- 4 Spots, GeoJSON der Region, Routen, Stunden-Refresh-Mechanik.

## Offene Frage

Soll ich die Wind-Anzeige ganz entfernen (wie Vorlage) oder als kleinen Zusatz unter dem Pill behalten?
