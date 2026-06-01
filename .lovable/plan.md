## Diagnose (Produktion, /embed/radar)

- **TTFB 4,25 s** — der Server schickt 4 Sekunden lang gar nichts. Ursache: der Route-Loader ruft `getRadarFrames()` server-seitig auf, bevor HTML rausgeht. Das war zwar gut gegen den zweiten Roundtrip, kostet aber jetzt direkt im TTFB.
- **FCP 4,64 s** = TTFB + ~400 ms Render. Sobald HTML da ist, ist die Seite fast sofort sichtbar. Das eigentliche Frontend ist nicht das Problem.
- **68 Kartenkacheln von wmts.geo.admin.ch, je ~1 s** — das sind nur visuelle Karten-Tiles, die nach FCP nachladen und Web-Vitals nicht direkt belasten, aber gefühlte „fertig"-Zeit.
- Bundle ist okay: nur 8 JS-Files, 241 KB total.

Ziel < 1 s First Contentful Paint heißt im Wesentlichen: **TTFB drastisch senken**.

## Plan

### 1. Radar-Fetch aus dem SSR-Loader entfernen (größter Hebel)

Den letzten Schritt rückgängig machen: `embed.radar.tsx` lädt Radar nicht mehr im Loader, sondern überlässt das Holen wieder dem Client (React Query in `RadarMap`). HTML geht damit sofort raus (~200–400 ms TTFB statt 4 s). Der zweite Roundtrip kommt parallel zum JS-Download und ist durch die schon gesetzten CDN-Header (`s-maxage=120, stale-while-revalidate=600`) bei wiederholten Aufrufen quasi gratis.

Falls wir den Initial-Roundtrip trotzdem sparen wollen, alternativ: `context.queryClient.prefetchQuery(...)` (fire-and-forget, streamt) statt `ensureQueryData` — blockiert TTFB nicht.

### 2. HTML der Embed-Routen am Edge cachen

In den Embed-Routen (`embed.radar`, `embed.pollen`, `embed.wind`, `embed.region`, `embed.all`) per `setResponseHeaders` Cache-Control setzen, z. B.
`public, max-age=60, s-maxage=300, stale-while-revalidate=3600`.
Das HTML ist für alle Besucher identisch → Cloudflare/CDN liefert die WordPress-Iframes ab dem zweiten Aufruf in ~50–150 ms aus.

### 3. Render-blocking CSS reduzieren

`styles-53ViXgF9.css` (16 KB, 269 ms) ist render-blocking. Pragmatisch: `<link rel="preload" as="style">` im `__root.tsx` head für die Embed-Routen hilft im Iframe-Kontext nur wenig. Akzeptabel lassen, da der Hebel klein ist verglichen mit Schritt 1+2.

### 4. Karten-Tiles (geo.admin.ch) entschärfen — optional

68 Tiles à ~1 s sind das Hauptgeräusch nach FCP. Zwei mögliche Eingriffe (nur falls gewünscht, ändert das Aussehen):
- Initialer Zoom-Level um 1 reduzieren → ca. 4× weniger Tiles.
- Auf einen schnelleren Tile-Provider wechseln (z. B. CartoDB Positron / OSM-Mirror via CDN). Geo.admin.ch ist hübsch, aber langsam und ohne CDN-Caching für uns.

Da das Aussehen ändert, würde ich Schritt 4 erst nach Bestätigung umsetzen.

### 5. Messen

Nach Umsetzung Schritt 1+2 erneut `/embed/radar` auf der Produktions-URL profilen. Erwartung:
- Erstaufruf: TTFB ~300–600 ms, FCP < 1 s.
- Wiederholter Aufruf (CDN-Hit): TTFB < 150 ms, FCP < 500 ms.

## Technische Notizen

- `src/routes/embed.radar.tsx`: Loader gibt nur noch `{ noscript }` zurück, `RadarMapLazy` bekommt kein `initialFrames` mehr (oder optional `initialFrames` über React-Query-Prefetch).
- Cache-Control setzen via `setResponseHeaders` aus `@tanstack/react-start/server` direkt im Loader jeder Embed-Route.
- `src/components/maps/radar-map.tsx`: `initialFrames`-Prop bleibt optional, schadet nicht.
- `src/lib/radar.functions.ts` / `forecast.functions.ts`: schon mit guten CDN-Headern versehen, kein Change nötig.
