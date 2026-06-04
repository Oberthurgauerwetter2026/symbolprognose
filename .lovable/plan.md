# Performance-Fix: Symbolprognose & Lokalprognose

## Befund

Aktuell ist jeder Aufruf der Karten-/Widget-Seiten teuer:

- **Region-Karte** ruft `getAggregatedForecast` **5× pro Mount** auf (4 Spots + 1 für `dataUpdatedAt`).
- **Lokalprognose-Widget** ruft es 1× pro Mount.
- Jeder Server-Call führt in `openmeteo-cache.server.ts` **parallel zwei R2-Downloads** aus (`forecast.json` **und** `symbol.json`), obwohl phaseA-Konsumenten nur `symbol.json` brauchen.
- `useQuery` setzt `refetchOnMount: "always"` → Client-Cache wird ignoriert, jeder Routen-Wechsel triggert neu.
- Keine HTTP-Cache-Header auf der Server-Function → CDN/Browser können nichts cachen, jeder Request schlägt durch bis zum Worker.

Ergebnis: 5 RPCs × (R2-Roundtrip + JSON-Parse großer Files) bei jedem Karten-Open. Cold Isolate verstärkt das.

## Plan

### 1. R2-Reader splitten (`src/lib/openmeteo-cache.server.ts`)

- Neuer Export `getSymbolCache()` lädt **nur** `openmeteo/symbol.json` (eigener Memo).
- Bestehendes `getOpenMeteoCache()` bleibt für Radar/Konsumenten von `forecast.json`.
- `forecast-aggregated.functions.ts` und alles, was nur `phaseA` braucht, nutzt `getSymbolCache()` → halbiert Bandbreite & Latenz pro Worker-Isolate.

### 2. Batch-Server-Function (`src/lib/forecast-aggregated.functions.ts`)

- Neue `getAggregatedForecastBatch({ points: {id,lat,lon}[], v? })` → liest **einmal** den Symbol-Cache, mappt per `pickNearest` für jeden Punkt, gibt `Record<id, ForecastResponse>` zurück.
- `getAggregatedForecast` (einzeln) bleibt für Bestandscode erhalten, delegiert intern an Batch-Pfad.
- Edge-Cache-Header setzen:
  `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`
  via `setResponseHeaders` im Handler. Damit dedupliziert Cloudflare wiederholte Requests auf gleiche Lat/Lon.

### 3. Region-Karte umstellen (`src/components/region-map.tsx`)

- **Eine** `useQuery` auf Parent-Ebene (`RegionMapInner`), die `getAggregatedForecastBatch` für alle `SPOTS` aufruft.
- `SpotMarker` bekommt den fertigen `ForecastResponse` als Prop (kein eigenes `useQuery` mehr).
- Liefert nebenbei das Timestamp für `dataUpdatedAt` ohne Extra-Call.
- 5 RPCs → **1 RPC**.

### 4. Widget-Cache-Hygiene (`src/components/weather-widget.tsx` und `region-map.tsx`)

- `refetchOnMount: "always"` entfernen, `staleTime` bleibt (2–5 min).
- Damit nutzt der Client den React-Query-Cache zwischen Routen-Wechseln statt jedes Mal neu zu fetchen.

### 5. Lokal-Embeds (`/embed/lokal`, `/embed/region-lokal`)

- `EmbedShell`/Route-Loader: `Cache-Control` ist bereits gesetzt (`embed-cache.functions.ts`). Zusätzlich `getAggregatedForecast` für Amriswil im **Route-Loader** vorladen (TanStack Query `ensureQueryData`), damit der erste Render schon Daten hat statt erst nach Hydration zu fetchen.

## Was sich NICHT ändert

- Keine Änderung an Ingest-Workflows, R2-Layout, AROME/Radar-Pfaden, Modell-Merge-Logik (`mergeArr`/`pickNearest`), UI/Design.
- `getMultiModelForecast`, `radar.functions.ts` unangetastet.

## Erwartete Wirkung

- Region-Karte: 5 → 1 Server-Call, jeweils nur 1 R2-File statt 2, plus CDN-Cache → Erstladung typischerweise **deutlich unter 1 s** statt mehrere Sekunden, Repeats nahezu instant.
- Lokalprognose: 1 Call mit Edge-Cache, plus Loader-Preload → spürbar schnelleres First-Paint im Embed.

## Verifikation

- DevTools Network: `/_serverFn/...getAggregatedForecast*` Anzahl auf Region-Karte = 1; Response-Header zeigt `cache-control: ... s-maxage=300`.
- Zweiter Karten-Open: Request kommt aus CF-Edge-Cache (`cf-cache-status: HIT`).
- Inhalte (Symbole, Temperaturen, Tageswahl) identisch zur jetzigen Anzeige.
