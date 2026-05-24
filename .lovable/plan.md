# Embed dynamisch / responsiv machen

Ziel: Die Einbettung `/embed/region-lokal` (Karte + Lokalprognose Amriswil) soll sich sauber an jede Iframe-Breite anpassen — auch wenn der WordPress-Container nur 320–500 px schmal ist, und beim live verkleinern des Browser-Fensters ohne Reload.

## Was heute klemmt

- **`RegionMap`** verwendet Viewport-Breakpoints (`sm:`) und eine **fixe Karten-Höhe** `h-[560px] sm:h-[600px]`. In schmalen Iframes wirkt die Karte überhoch; bei sehr engen Containern bleibt der Pill-Marker am Rand stehen.
- **`EmbedShell`** hat `max-w-6xl px-3 py-3 sm:px-5 sm:py-5` — bei schmaler Einbettung frisst das Padding wertvolle Pixel.
- **`WeatherWidget` (`detailOnly`)** nutzt bereits Container-Queries (`@container` mit `@[640px] / @[900px]`) und ist intern schon fluid — das passt.
- Negative Ränder `-mx-3` der Karte (für Vollbreite auf Mobil im Dashboard) sind im Embed unerwünscht, weil sie aus der Iframe-Hülle herausragen.

## Änderungen

### 1) `src/components/region-map.tsx`
- Im äußersten Wrapper `@container` ergänzen, damit Karten-Größe an die **Container-Breite** (nicht Viewport) gekoppelt ist.
- Karten-Frame im `bare`-Modus:
  - statt `-mx-3 h-[560px] w-auto sm:mx-0 sm:h-[600px] sm:w-full sm:rounded-2xl`
  - neu: `w-full rounded-xl @[640px]:rounded-2xl aspect-[4/3] @[520px]:aspect-[16/11] @[820px]:aspect-[16/10] min-h-[320px] max-h-[640px]`
  - dadurch wächst/schrumpft die Karte proportional zur verfügbaren Breite, kein Überhang mehr.
- `BoundsFitter` läuft bereits bei `resize` → nach Höhen-Änderung passt Leaflet die Karten-Bounds automatisch wieder an. Zusätzlich `ResizeObserver` auf den Karten-Container, der `map.invalidateSize()` + `fitBounds` triggert (greift, wenn nur der Iframe — nicht das Fenster — schrumpft).
- Nicht-`bare`-Modus (Dashboard) bleibt unverändert.

### 2) `src/components/embed-shell.tsx`
- Padding fluider: `px-2 py-2 @[520px]:px-4 @[520px]:py-4` und Wrapper als `@container` markieren.
- `max-w-6xl` bleibt — schadet bei schmalem Host nicht, greift erst bei breitem Host.

### 3) `src/routes/embed.region-lokal.tsx`
- Abstand zwischen Karte und Detailpanel von `mt-4` → `mt-3 @[640px]:mt-5` (innerhalb eines `@container`-Wrappers).

### 4) `src/components/weather-widget.tsx` (`detailOnly`-Zweig)
- Padding etwas kompakter für sehr schmale Iframes: `py-3 px-2 @[640px]:py-6 @[640px]:px-5 @[900px]:py-8 @[900px]:px-6` (nur im `detailOnly`-Return — der Dashboard-Pfad bleibt).

## Was nicht angefasst wird

- Daten-Logik, Wettermodelle, Spots, Caching — keine Änderung.
- `RegionMap` nicht-`bare`-Variante, `WeatherWidget` Dashboard-Variante, andere Embed-Routen (`/embed/region`, `/embed/lokal`, `/embed/all`).
- `routeTree.gen.ts` (Auto-Generated).

## Technische Notizen

- Tailwind v4 Container-Queries sind im Projekt bereits aktiv (siehe `weather-widget.tsx` `@[640px]:` Klassen) — keine neuen Dependencies.
- Höhe-Postmessage via `EmbedShell` `ResizeObserver` greift weiterhin, wenn sich die Karten-Aspect-Ratio ändert.

