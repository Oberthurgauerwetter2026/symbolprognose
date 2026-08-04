# Karten schneller laden, doppeltes Laden der Regionskarte beenden

## Was heute passiert (geprüft im Code)

Alle Kartenrouten (`karten.region`, `karten.radar`, `karten.niederschlag`, `karten.satellit`, `karten.wind`, `karten.warnungen`) laufen mit `ssr: false`. Dadurch entsteht eine Kette aus Wartezeiten, die nacheinander abläuft:

1. HTML kommt an, zeigt nur eine leere Hülle (kein Server-Rendering).
2. Der Route-Code wird geladen.
3. Erst danach startet der Lazy-Chunk der Karte (Regionskarte, Radar, Satellit, Niederschlag) — währenddessen der graue Platzhalter.
4. Erst wenn die Kartenkomponente da ist, startet die Datenabfrage (`useQuery` im Bauteil). Nur die Radarroute lädt Daten vorab im Loader.

Das erklärt das Gefühl "die Regionskarte lädt zweimal": zuerst der grauer Kasten für den Karten-Chunk, dann noch einmal ein Ladezustand, weil die Wetterdaten erst danach angefordert werden. Zusätzlich sind Daten nach einem Reload nie sofort da, weil der Query-Cache nicht über Seitenneuladen hinweg gespeichert wird (im Router steht ein Kommentar zu einem Persister, ein Persister ist aber nicht eingerichtet).

## Was gebaut wird

1. Daten parallel zum Code laden (alle Karten)
   - In jeder Kartenroute im `loader` die zugehörige Abfrage vorab anstoßen (`queryClient.prefetchQuery`, nicht blockierend), so wie es bei Radar bereits gemacht wird:
     - Region: Wetter-Batch aller Spots + Warnungen
     - Warnkarte: Warnungen
     - Niederschlagssummen: Radar-Frames (extended)
     - Wind: Windfelder
     - Satellit: Satellitenframes
   - Query-Keys und Optionen werden in kleine gemeinsame "queryOptions"-Bausteine ausgelagert, damit Loader und Komponente exakt denselben Eintrag benutzen (sonst lädt es doppelt).

2. Karten-Chunk früher anfordern
   - Beim Hovern/Antippen der Karten-Tabs und Übersichtskacheln den passenden Lazy-Chunk vorladen (`preload`-Funktion pro Karte in `lazy-maps.ts`).
   - Im Loader der Kartenroute den Chunk-Import zusätzlich sofort starten, damit Chunk und Daten gleichzeitig laufen statt hintereinander.

3. Nur ein Ladezustand statt zwei
   - Regionskarte, Radar, Satellit und Niederschlag erhalten einen einheitlichen Karten-Skeleton (gleiche Höhe, gleiche Optik) für Chunk- und Datenphase, sodass optisch ein durchgehender Ladevorgang zu sehen ist und kein zweiter "Neustart".

4. Daten über Neuladen hinweg behalten
   - Query-Cache in `localStorage` persistieren (`persistQueryClient` mit `maxAge` 24 h, passend zum bereits gesetzten `gcTime`), nur für die Karten-Query-Keys.
   - Wirkung: Beim Neuladen oder erneuten Öffnen ist sofort der letzte Stand sichtbar, im Hintergrund wird aktualisiert — statt leerer Karte.

5. Kleinere Bremsen entfernen
   - `defaultPreloadStaleTime` im Router so setzen, dass vorgeladene Routen nicht sofort erneut laden.
   - Warnkarte: `staleTime: 0` bleibt für Echtzeit, aber der erste Aufruf nutzt die vorab geladenen Daten aus dem Loader statt einer zweiten Anfrage.

## Nicht Teil dieses Schritts

Das zweite Projekt (weatherhub) ist ein eigenes Projekt und kann hier nicht mitgeändert werden. Wenn die Verbesserungen hier greifen, kann derselbe Ansatz dort in einem eigenen Auftrag übernommen werden.

## Technische Details

- Neue Datei `src/lib/map-queries.ts` mit `queryOptions(...)` für: `map-weather-batch/v9`, `warnings`, `radar-frames`, `radar-frames-accum/extended`, Wind, Satellit.
- Betroffene Dateien: `src/routes/karten.region.tsx`, `karten.warnungen.tsx`, `karten.niederschlag.tsx`, `karten.wind.tsx`, `karten.satellit.tsx`, `karten.radar.tsx`, `src/components/maps/lazy-maps.ts`, `src/components/map-tabs.tsx`, `src/components/region-map.tsx`, `src/components/maps/warn-map.tsx`, `wind-map.tsx`, `satellite-map.tsx`, `src/router.tsx`.
- Server-Funktionen werden im Loader direkt aufgerufen (kein `useServerFn` nötig); in den Komponenten bleibt `useServerFn` erhalten, die Query-Keys müssen aber identisch sein.
- Persister: `@tanstack/query-sync-storage-persister` + `@tanstack/react-query-persist-client`, nur im Browser aktiv (kein Zugriff auf `localStorage` beim Server-Rendern).
- Kein Eingriff in Datenquellen, Ingest-Skripte oder Warnlogik.

## Prüfung

Jede Kartenroute nach Hard-Reload öffnen und die Ladephasen im Netzwerk-Wasserfall vergleichen: Daten- und Chunk-Anfrage sollen gleichzeitig starten, und die Regionskarte darf nur einen Ladezustand zeigen.
