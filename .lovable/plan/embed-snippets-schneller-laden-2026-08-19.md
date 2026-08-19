# Embed-Snippets schneller laden

## Befund (im Code geprüft)

Alle Karten-Embeds laden heute streng nacheinander:

1. HTML der Embed-Route (bei `/embed/region`, `/embed/warnungen`, `/embed/widget-warnungen`, `/embed/all` mit `ssr: false` — also erst eine leere Seite)
2. App-Bundle + Route-Chunk
3. Karten-Chunk (`lazy(() => import(...))` in jeder Route, teils zusätzlich hinter `ClientOnly`)
4. erst danach der erste Datenabruf (Radar-/Wind-/Satellit-Manifest, Symbolprognose, Warnungen) — kein Route-Loader startet diese Daten vor.

Dadurch wartet der Nutzer zwei bis drei Rundreisen, bevor überhaupt etwas Sichtbares kommt. Zusätzlich hat die Warnungs-Query `staleTime: 0` (`src/lib/map-queries.ts`), lädt also bei jedem Mount neu, und im WordPress-Snippet fehlt bei den meisten iframes das Vorwärmen der Verbindung zu den Datendomänen.

## Änderungen

1. **Daten parallel zum Code laden.** Jede Embed-Route startet ihre Datenabfrage im Route-Loader (nicht abwartend, damit das erste Rendern nicht blockiert): Radar-Embeds die Radarframes, Wind-Embeds die Windfelder, Satellit-Embeds das Manifest, Region/Lokalprognose die Symbolprognose, Warn-Embeds die Warnungen. Bisher startete das erst nach dem Rendern der Karte.
2. **Karten-Chunk früher anfordern.** Der Karten-Import wird im Loader angestossen (die vorhandenen `preload*`-Funktionen aus `src/components/maps/lazy-maps.ts` nutzen) statt erst beim Rendern, und alle Embed-Routen verwenden diese gemeinsamen Lazy-Komponenten anstelle eigener `lazy()`-Aufrufe. So laden Chunk und Daten gleichzeitig.
3. **Kein unnötiges `ssr: false`.** Wo das Embed nur eine Karte zeigt, bleibt `ClientOnly` für Leaflet, aber die Route selbst rendert serverseitig die Hülle inkl. Platzhalter — damit erscheint sofort ein sauberer Rahmen statt einer leeren weissen Fläche.
4. **Einheitlicher Platzhalter.** Alle Embeds nutzen `MapSkeleton` statt uneinheitlicher grauer Blöcke, damit Chunk- und Datenphase wie ein einziger Ladevorgang aussehen und die iframe-Höhe nicht springt.
5. **Weniger Doppelabrufe.** `warningsQuery` bekommt einen kurzen `staleTime` (30 s) statt 0, damit ein Embed beim Mount nicht sofort neu lädt; Realtime-Aktualisierung bleibt unverändert.
6. **Snippets vorwärmen.** In `src/routes/embed-info.tsx` erhalten die generierten Snippets zusätzlich `preconnect`/`dns-prefetch` auf die Datendomäne (R2/Kachel-Host) und `loading="lazy"` bleibt nur dort, wo das Widget typischerweise weit unten steht; Widgets oberhalb der Falz bleiben `eager` mit hoher Priorität.

Optik, Bedienung, Höhenanpassung und Quellenangaben bleiben unverändert.

## Technisch

- `src/routes/embed.*.tsx`: Loader ergänzen um `setEmbedCacheHeaders()` (falls fehlend) + `void context.queryClient.ensureQueryData(<passende Query aus map-queries.ts>)` + `preload*Map()`; eigene `lazy()`-Definitionen durch `Lazy*Map` aus `lazy-maps.ts` ersetzen; `MapSkeleton` als Suspense/ClientOnly-Fallback.
- `src/lib/map-queries.ts`: `warningsQuery` `staleTime: 30_000`.
- `src/routes/embed-info.tsx`: Snippet-Builder um zusätzliche `preconnect`-Zeile und differenziertes `loading`/`fetchpriority` erweitern.
- Betroffene Routen: `embed.region`, `embed.lokal`, `embed.lokalprognose`, `embed.lokal-suche`, `embed.region-lokal`, `embed.radar`, `embed.wind`, `embed.satellit`, `embed.satellit-loop`, `embed.warnungen`, `embed.widget-radar`, `embed.widget-wind`, `embed.widget-warnungen`, `embed.all`.

## Prüfung

Embeds in der Preview laden und im Netzwerk-Wasserfall bestätigen, dass Karten-Chunk und erster Datenabruf gleichzeitig starten und der Platzhalter ohne Höhensprung durch die Karte ersetzt wird.
