# Embed `/embed/region-lokal` für sehr schmale Container

Ziel: Der Einbettungscode soll auch in sehr engen WordPress-Spalten (ab ~280–320 px) sauber Platz finden, ohne Mindesthöhen oder Padding zu erzwingen, die den Host-Container sprengen.

## Was heute noch klemmt

- **Karte erzwingt `min-h-[320px]`** — bei einer 280–300 px breiten Spalte sieht die Karte dadurch viel zu hoch aus (Aspect bricht).
- **Karte hat erst ab `@[520px]` ein schlankeres Aspect** — darunter bleibt sie auf 4:3, was bei sehr schmal viel vertikalen Platz frisst.
- **`EmbedShell` Padding** `px-2 py-2` ist bei 280 px noch spürbar — wertvolle Bildbreite geht verloren.
- **DetailPanel-Wrapper** im `detailOnly` hat `px-2 py-3` — gleicher Effekt.
- **DayStrip / Hourly-Slots im DetailPanel** haben `basis-[70%]` als Default und `p-3` Padding — auf sehr schmal wirken die Karten zu groß und scrollen nur knapp.

## Änderungen (alle nur im Embed-Pfad, keine Änderung am Dashboard)

### 1) `src/components/region-map.tsx` (nur `bare`-Branch, Zeile 513)
Aktuell:
```
w-full rounded-xl @[640px]:rounded-2xl aspect-[4/3] @[520px]:aspect-[16/11] @[820px]:aspect-[16/10] min-h-[320px] max-h-[640px]
```
Neu:
```
w-full rounded-lg @[420px]:rounded-xl @[640px]:rounded-2xl aspect-square @[360px]:aspect-[5/4] @[480px]:aspect-[4/3] @[640px]:aspect-[16/11] @[820px]:aspect-[16/10] min-h-[200px] max-h-[640px]
```
- `min-h` von 320 → 200 px (greift faktisch nur unter ~270 px Breite).
- Frühere, feinere Aspect-Stufen ab 360/480 px statt erst ab 520 px.
- Bei sehr schmal (≤360 px) quadratisch — kompakteste sinnvolle Kartenform.

### 2) `src/components/embed-shell.tsx`
- Padding noch weiter herunter: `p-0 @[360px]:p-2 @[520px]:p-4`.
- Bei sehr schmal: kein Padding → volle Hostbreite für die Karte.

### 3) `src/components/weather-widget.tsx` (`detailOnly`-Return, Zeile 166)
- Padding: `py-2 px-1 @[420px]:py-3 @[420px]:px-2 @[640px]:py-6 @[640px]:px-5 @[900px]:py-8 @[900px]:px-6`.
- Innerer Wrapper `max-w-5xl mx-auto` bleibt.

### 4) `src/routes/embed.region-lokal.tsx`
- Abstand: `mt-2 @[420px]:mt-3 @[640px]:mt-5` (statt aktuell `mt-3 @[640px]:mt-5`).

## Nicht angefasst

- Dashboard-Pfade (`RegionMap` ohne `bare`, `WeatherWidget` ohne `detailOnly`).
- Andere Embed-Routen.
- Daten- / Forecast-Logik.
- `routeTree.gen.ts`.

## Hinweis zum Einbinden

Das Iframe-Snippet liefert die Höhe per `postMessage` bereits dynamisch — durch die neue Aspect-Treppe verkleinert sich die Höhe in schmalen Spalten von selbst automatisch mit.
