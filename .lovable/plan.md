## Befund

Die Embeds laden in WordPress aus mehreren überlagerten Gründen langsam:

1. **`loading="lazy"` auf dem iframe** — Browser warten, bis das iframe nah am Viewport ist. Wenn die Karte weiter unten auf der WP-Seite steht, beginnt der Ladevorgang erst beim Scrollen.
2. **Kein DNS-/Verbindungs-Warmup** — beim ersten iframe-Request muss WordPress erst DNS auflösen, TLS aushandeln und Cloudflare ggf. eine Bot-Challenge zeigen, bevor überhaupt HTML kommt.
3. **`ssr: false` auf den meisten Embed-Routen** (`region`, `wind`, `pollen`, `all`) — der Browser bekommt eine leere HTML-Shell und muss erst JS laden, parsen, ausführen und dann die API-Calls machen, bevor irgendetwas sichtbar wird.
4. **Radar speziell** — lädt Leaflet (~150 KB) plus die Server-Function `getRadarFrames` (Bilder-Manifest) plus `getMultiModelForecast`. Das ist clientseitig immer "spürbar".

## Lösung

### 1. Snippet anpassen (sofortiger, sichtbarer Effekt)

In `src/routes/embed-info.tsx`, Funktion `buildSimpleSnippet` (und `buildAmriswilSnippet`):

- `loading="lazy"` durch `loading="eager"` ersetzen — Karte beginnt sofort zu laden.
- `fetchpriority="high"` ergänzen — Browser priorisiert das iframe gegenüber anderen Ressourcen.
- Vor dem `<iframe>` einen Preconnect-Hint ausgeben:
  ```html
  <link rel="preconnect" href="https://symbolprognose.lovable.app" crossorigin>
  <link rel="dns-prefetch" href="https://symbolprognose.lovable.app">
  ```
  WordPress rendert das im `<body>`, das ist OK — moderne Browser akzeptieren es auch dort.
- Im UI-Hinweistext ergänzen: "Wenn die Karte weiter unten auf der Seite eingebunden ist, kann `loading=\"lazy\"` zurückgesetzt werden, um Bandbreite zu sparen."

### 2. SSR für die einfachen Embeds einschalten

`embed.region.tsx`, `embed.wind.tsx`, `embed.pollen.tsx`, `embed.all.tsx`: `ssr: false` entfernen. Diese Routen rendern HTML, das auch ohne JS sinnvoll ist (Pollen/Wind = ComingSoon-Card, Region/All = Karte mit ClientOnly-Fallback). Die Karten selbst bleiben dank `ClientOnly`/`lazy` clientseitig, aber der HTML-Shell ist sofort da → Browser sieht etwas, statt "weiss".

Falls beim Build SSR-Fehler auftauchen (z. B. `RegionMap` greift modul-weit auf `window`), den jeweiligen Map-Import in einen `lazy(() => import(...))` + `ClientOnly`-Wrapper analog zum Radar packen, statt SSR wieder auszuschalten.

### 3. Radar-Embed: Asset-Caching prüfen

Die Server-Function `getRadarFrames` cached intern (sollte Cloudflare-CDN-fähig sein). Ein `Cache-Control: public, max-age=60, stale-while-revalidate=300` auf der Response würde wiederkehrende WP-Besucher massiv beschleunigen. Wenn das schon gesetzt ist → unverändert lassen.

## Was nicht hilft

- Compute-Upgrade der Lovable Cloud — das Problem ist Netzwerk-/Render-Latenz im Browser, nicht Backend-CPU.
- Iframe entfernen / direkt einbinden — geht in WordPress nicht ohne Plugin-Aufwand.

## Verifikation

Nach dem Deploy auf der WP-Seite mit DevTools (Network-Tab, "Disable cache") laden:
- iframe-Request startet sofort beim Pageload (nicht erst beim Scrollen).
- First Paint im iframe < 1 s nach dem iframe-Request für region/wind/pollen/all.
- Radar zeigt innerhalb 1-2 s den grauen Karten-Hintergrund, dann die Radar-Bilder.
