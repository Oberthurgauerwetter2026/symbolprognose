## Ziel

Der Embed `/embed/region-lokal` ("Wetterkarte + Lokalprognose Amriswil") soll kompakter werden, damit er sich gut in beliebige Seiten (Blog-Artikel, Sidebars, Spalten) einbetten lässt, ohne 100 % Viewport-Höhe zu beanspruchen.

## Aktueller Zustand

`src/routes/embed.region-lokal.tsx` nutzt `EmbedShell` mit `fillViewport=true` → das Embed füllt immer `100dvh`. In einem WordPress-Artikel mit fester iframe-Höhe wird die Karte dadurch entweder zu hoch oder zu klein, und das Layout passt sich der Host-Seite nicht an.

```
EmbedShell fillViewport        → 100dvh, kein postMessage
  RegionMap bare fill          → h-full (füllt verfügbare Höhe)
  WeatherWidget detailOnly compact  → natürliche Höhe
```

## Änderung

1. **`src/routes/embed.region-lokal.tsx`**
   - `fillViewport` entfernen → `EmbedShell` postet die tatsächliche Höhe per `postMessage` an den Host (gleiches Verhalten wie die anderen `/embed/*`-Routen).
   - `RegionMap` nicht mehr im `fill`-Modus, sondern im `bare`-Modus mit responsiven Aspect-Ratios + Höhendeckel — so wird die Karte automatisch klein in schmalen Spalten und nutzt bis zu ca. 420 px Höhe in breiten.
   - Wrapper auf Stack ohne `h-full`/`overflow-hidden` umstellen, damit die Gesamthöhe natürlich aus Karte + Lokalprognose entsteht.

2. **`src/components/region-map.tsx`** (`bare`-Pfad anpassen, nur für das Embed relevant)
   - `max-h-[640px]` auf `max-h-[420px]` reduzieren und Aspect-Ratios pro Container-Breakpoint leicht flacher wählen (z. B. `aspect-[5/4]` / `aspect-[16/10]` / `aspect-[16/9]`), so dass die Karte selbst auf breiten Embeds nicht dominiert.

3. **`src/components/weather-widget.tsx`** (`detailOnly + compact`-Pfad)
   - Padding im `compact`-Wrapper bleibt schlank, aber sicherstellen, dass die Höhenmeldung an den Host stabil ist (kein zusätzliches Tuning nötig — die bestehende `postMessage`-Logik in `WeatherWidget` läuft weiter, EmbedShell sendet zusätzlich die Gesamthöhe).

## Out of scope

- `/karten/radar`, `/karten/lokal`, `/karten/region` (Vollseiten) bleiben unverändert.
- Datenquellen, Cron, RLS, Auth: nichts angefasst.
- Andere `/embed/*`-Routen (`/embed/lokal`, `/embed/region`) bleiben unverändert.

## Verifikation

- `/embed/region-lokal` in einem schmalen Container (~360 px) → Karte ~quadratisch, Lokalprognose darunter, Gesamthöhe < 700 px.
- `/embed/region-lokal` in einem breiten Container (~960 px) → Karte ~16:9 mit Deckel 420 px, Lokalprognose darunter.
- iframe-Auto-Resize: `lovable-weather:height` wird vom EmbedShell gesendet (Höhe = scrollHeight des Wrappers).
