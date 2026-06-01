## Ziel

Cache-Header + Client-Side-Fetching-Muster (wie bei `embed.radar`) auf die verbleibenden SSR-Embed-Routen anwenden, damit alle Snippets gleich schnelles TTFB/FCP liefern.

## Aktueller Stand


| Route                    | Cache-Header    | SSR-Fetch im Loader      |
| ------------------------ | --------------- | ------------------------ |
| `embed.radar`            | ✅               | ❌ (client)               |
| `embed.pollen`           | ✅               | — (kein Fetch)           |
| `embed.wind`             | ✅               | — (kein Fetch)           |
| `embed.region`           | — (`ssr:false`) | —                        |
| `embed.all`              | — (`ssr:false`) | —                        |
| `**embed.lokal**`        | ❌               | ✅ blockiert SSR (~3–4 s) |
| `**embed.region-lokal**` | ❌               | ✅ blockiert SSR (~3–4 s) |


## Änderungen

### 1. `src/routes/embed.lokal.tsx`

- `setEmbedCacheHeaders` importieren.
- Loader umbauen analog Radar: kein `getMultiModelForecast`-Call mehr im Loader. Stattdessen:
  ```ts
  loader: () => {
    setEmbedCacheHeaders();
    return { noscript: EMPTY_NOSCRIPT };
  }
  ```
  Konstante `EMPTY_NOSCRIPT: LokalNoscriptData = { locationName: AMRISWIL.name, hourly: [], daily: [] }` auf Modulebene anlegen.
- Forecast wird ohnehin clientseitig via `WeatherWidget` (eigener Fetch/Query) geholt; der `<noscript>`-Fallback bleibt strukturell vorhanden (Embed ist `noindex`, daher kein SEO-Verlust).

### 2. `src/routes/embed.region-lokal.tsx`

- Gleiches Muster: `setEmbedCacheHeaders` importieren, Loader auf
  ```ts
  loader: () => {
    setEmbedCacheHeaders();
    return { noscript: EMPTY_NOSCRIPT };
  }
  ```
  reduzieren, `EMPTY_NOSCRIPT` als Modul-Konstante.

### 3. Keine Änderung

- `embed.region`, `embed.all`: `ssr:false` (kein Loader-Header möglich, hatte zuvor SSR-Fehler verursacht). Cache greift via Cloudflare-Defaults für das statische Shell-HTML.
- `embed.radar/pollen/wind`: bereits umgesetzt.

## Erwartetes Ergebnis

Alle SSR-Embed-Routen liefern HTML in ~300–600 ms TTFB (cold) bzw. <200 ms (CDN-Hit), Forecast lädt parallel zum JS-Bundle clientseitig. `embed.lokal` und `embed.region-lokal` werden damit auf das gleiche ~1 s-FCP-Niveau wie Radar gebracht.

&nbsp;

Auch in den anderen  Projekten umsetzen