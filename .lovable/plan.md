# Druckkarte (Luftdruck MSL) mit Isobaren

Neue Kartenseite `/karten/druck` im gleichen Stil wie Radar und Wind: Isobaren-Linien auf Meeresniveau, Hoch-/Tiefdruck-Zentren mit H/T-Markierung und Filmstrip-Zeitachse über die nächsten 48 Stunden.

Hinweis zur gewählten Vorgabe: da keine Rückmeldung zum Umfang kam, wird die Variante mit eigener Kartenseite umgesetzt, Ausschnitt wie bei Radar/Wind (Ostschweiz/Bodenseeraum). Auf diesem kleinen Gebiet verlaufen Isobaren fast gerade — die Karte zeigt deshalb zusätzlich den Druckwert farbig als Fläche und die Drucktendenz (Änderung der letzten 3 h), damit die Darstellung aussagekräftig bleibt. Eine Ausweitung auf Mitteleuropa ist später möglich, braucht aber ein zusätzliches, gröberes Datenraster.

## Was gebaut wird

1. **Datenbasis**: Der bestehende stündliche Gitter-Ingest (ICON-CH1/CH2 über dem Karten-Ausschnitt) liefert künftig zusätzlich den Luftdruck auf Meeresniveau. Kein neuer Workflow, kein neuer Cron — dieselbe Datei, ein Feld mehr.
2. **Kartenseite** `/karten/druck`:
   - Farbfläche für den Druck (Skala ca. 985–1035 hPa, blau = tief, rot = hoch)
   - Isobaren als Linien im 1-hPa-Schritt mit Beschriftung
   - H/T-Symbole an lokalen Maxima/Minima
   - Filmstrip-Zeitachse mit Play, kinetischem Scrollen und Haptik wie bei Radar/Wind
   - Referenzstädte-Marker, Zoom-Synchronisation der Canvas-Ebene, „i"-Legende
   - Quellenangabe unterhalb der Karte: „Quelle: Oberthurgauer Wetter · MeteoSchweiz ICON-CH1/CH2 (OGD)"
3. **Einbindung**: neuer Eintrag in der Kartenliste (Tabs, Übersicht) mit Symbol und Beschreibung, Lazy-Loading und Preload wie die anderen Karten.

## Technische Umsetzung

- `scripts/ingest_openmeteo.py`: `pressure_msl` in die stündlichen Grid-Phasen (phase1 ICON-CH1, phase2 ICON-CH2) aufnehmen.
- `src/lib/pressure.functions.ts`: neue Serverfunktion `getPressureFrames()` analog `wind.functions.ts` — liest den R2-Open-Meteo-Cache, baut `PressurePayload { bbox, gridLat, gridLon, frames: { t, pmsl[] }[] }`, +0…+48 h stündlich, mit leerem Payload + `warning` statt Fehler bei fehlendem Cache.
- `src/lib/map-queries.ts`: `pressureFramesQuery()` ergänzen, Key `pressure-frames` zu `PERSISTED_QUERY_PREFIXES` hinzufügen.
- `src/components/maps/pressure-map.tsx`: Leaflet-Karte + Canvas-Overlay. Bilineares Upsampling des Grids, Farbfläche, Isobaren über Marching-Squares auf dem interpolierten Feld, Labels entlang der Linien, H/T-Erkennung über lokale Extrema mit Mindestabstand. Wiederverwendung von `canvas-zoom-anim.ts`, `filmstrip-timeline.tsx`, `city-markers.tsx`; Crossfade zwischen Stundenframes wie beim Radar.
- `src/components/maps/lazy-maps.ts`: `LazyPressureMap` + `preloadPressureMap`, Eintrag in `MAP_CHUNK_PRELOADERS`.
- `src/lib/maps-config.ts`: `MapId` um `"druck"` erweitern, `routePath: "/karten/druck"`, Icon `Gauge`, Reihenfolge nach „Niederschlag".
- `src/routes/karten.druck.tsx`: Route mit eigenem `head()` (Titel, Description, og-Tags), Loader mit `ensureQueryData` und `useSuspenseQuery` in der Komponente, gleiche Struktur wie `karten.wind.tsx`.

## Nicht enthalten

- Kein Embed-Snippet für die Druckkarte (kann später ergänzt werden).
- Keine Druckwerte in Lokalprognose oder Push-Warnungen.
