## Problem

Auf dem externen Monitor zeigt das Embed nur den blauen Wrapper-Hintergrund (`#eaf2fb`). Der SSR-Fallback (`LokalNoscript`) ist im HTML enthalten, wird aber per CSS ausgeblendet:

```
.embed-fallback { display: block; }
.embed-live     { display: none; }
html.js-ok .embed-fallback { display: none; }
html.js-ok .embed-live     { display: block; }
```

`EmbedShell` setzt `html.js-ok` direkt in `useEffect` beim Mount. Auf dem Display passiert genau das, was die Konsolen-Logs zeigen:

```
TypeError: Importing a module script failed.
```

Ein nachgelagerter dynamischer Chunk (z. B. `weather-widget`, `useQuery`, eine lazy importierte Map-Komponente) schlägt nach dem Hydratisieren fehl. Da `js-ok` schon gesetzt ist, ist der Fallback unsichtbar, das Live-Widget rendert aber nichts → blauer Wrapper bleibt sichtbar.

## Plan

### 1. `src/components/embed-shell.tsx` — `js-ok` erst setzen, wenn der Live-Inhalt wirklich da ist + bei Fehlern zurücknehmen

- `document.documentElement.classList.add("js-ok")` NICHT mehr unbedingt im ersten `useEffect`. Stattdessen:
  - Beim Mount kurz warten (z. B. `requestAnimationFrame` ×2) und prüfen, ob im eigenen Container tatsächlich gerendert wurde (`ref.current?.getBoundingClientRect().height > 40`). Erst dann `js-ok` setzen.
  - Globaler Listener auf `window` für `error` und `unhandledrejection`: enthält die Message `"Importing a module script"` / `"Failed to fetch dynamically imported module"` / `"ChunkLoadError"`, wird `html.classList.remove("js-ok")` aufgerufen, sodass der SSR-Fallback wieder erscheint.
  - Listener werden in `useEffect`-Cleanup wieder entfernt.

### 2. `src/routes/embed.region-lokal.tsx` — React Error Boundary um das Live-Widget

- Neue minimale Error-Boundary-Komponente (lokal im File oder unter `src/components/embed-error-boundary.tsx`).
- Wrappt `<EmbedShell><WeatherWidget …/></EmbedShell>`.
- Im `componentDidCatch` wird `html.classList.remove("js-ok")` gesetzt und die Boundary rendert `null` (Fallback ist dann wieder sichtbar, weil CSS greift).
- Damit fangen wir sowohl Chunk-Lade-Fehler als auch Render-Fehler im Widget ab.

### 3. `src/styles.css` — defensiver Hintergrund für den Embed-Body

- Im selben Block wie `.embed-fallback`/`.embed-live`: dem `body` der Embed-Routen einen weissen/`bg-card`-Hintergrund geben (`html, body { background: #ffffff; }` nur innerhalb `body.embed-body`). Optional über eine neue Klasse, die `EmbedShell` auf `document.body` setzt.
- Effekt: Selbst im allerschlimmsten Fall (komplettes Bundle scheitert, kein React) sieht der Nutzer einen weissen Hintergrund statt blau, sodass der SSR-Fallback-Text immer auf weissem Grund steht und nicht im blauen Wrapper „verschwindet".

### 4. Anwenden auf alle Embeds mit Fallback

- Dieselbe Boundary auch in `src/routes/embed.lokal.tsx` und `src/routes/embed.region.tsx` (falls dort der gleiche Fallback-Mechanismus benutzt wird). Kurz prüfen und ggf. angleichen, damit dasselbe Problem dort nicht wiederkehrt.

### 5. Verifikation

- `curl https://symbolprognose.lovable.app/embed/region-lokal` enthält weiterhin den `LokalNoscript`-Inhalt mit „Amriswil" im SSR-HTML.
- Im Browser mit funktionierendem JS: weiterhin das Live-Widget sichtbar.
- Simulation: einen Chunk-Import von Hand fehlschlagen lassen (z. B. Netzwerk im DevTools blocken) → SSR-Fallback erscheint statt blauem Hintergrund.
- Auf dem Display-Browser: Erwartet wird nach Publish entweder das Live-Widget oder der lesbare SSR-Fallback, nie mehr nur blau.
