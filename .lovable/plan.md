## Problem

1. **Flackern beim Animieren** — Radar-Messung-Frames werden als `<ImageOverlay key={...t}>` gerendert. Bei jedem Framewechsel wird das Overlay entfernt und neu gemountet; das Bild muss laden/decodieren → kurzes Aufblitzen/Leerframe.
2. **Langsame Ladezeit** — PNGs werden erst beim Anzeigen aus R2 geladen. Beim Scrubben/Play wartet jeder Frame auf das Netzwerk.

## Fix

### 1. PNG-Frames vorab in den Browser-Cache laden (`src/components/maps/radar-map.tsx`)
Sobald Radar-Daten ankommen, in einem `useEffect` alle `precipUrl` und `hailUrl` per `new Image()` parallel anstossen. Der Browser cached und dekodiert sie vorab, sodass der spätere Frame-Wechsel sofort sichtbar ist.

```ts
useEffect(() => {
  if (!data) return;
  const imgs: HTMLImageElement[] = [];
  for (const f of data.frames) {
    if (f.precipUrl) { const i = new Image(); i.decoding = "async"; i.src = f.precipUrl; imgs.push(i); }
    if (f.hailUrl)   { const i = new Image(); i.decoding = "async"; i.src = f.hailUrl;   imgs.push(i); }
  }
  return () => { imgs.forEach(i => { i.src = ""; }); };
}, [data]);
```

### 2. Minimaler Crossfade für PNG-Frames
Beim Framewechsel nie ein leeres Bild sichtbar werden lassen: der nächste Frame wird als zweites `<ImageOverlay>` mit `opacity: 0` vorgehalten. Während `playing` läuft ein **sehr kurzer, dezenter Übergang** (~120 ms opacity-Crossfade), sodass das alte Bild kaum merklich in das neue übergeht — kein hartes Flackern, aber auch kein auffälliger Blende-Effekt. Im Pause-Modus snappt es weiterhin direkt auf einen Frame.

Statt dem hartcodierten `blendNextPng = null`:
```ts
const blendNextPng =
  playing && nextFrame?.precipUrl && currentFrame?.precipUrl ? nextFrame : null;
```

Zusammen mit (1) liegen die nächsten Frames bereits im Cache → der minimale Übergang rendert sofort ohne Wartezeit.

### 3. Radar-Daten frühzeitig anstossen (`src/routes/karten.radar.tsx`)
`ssr: false` mit `lazy()` bedeutet: Chunk + Daten starten erst nach Mount. Schon vor dem Lazy-Import einen Fetch anstossen:

```ts
import { getRadarFrames } from "@/lib/radar.functions";

export const Route = createFileRoute("/karten/radar")({
  ssr: false,
  loader: ({ context }) =>
    context.queryClient.prefetchQuery({
      queryKey: ["radar-frames"],
      queryFn: () => getRadarFrames(),
      staleTime: 5 * 60_000,
    }),
  component: KartenRadarPage,
  // …
});
```

`prefetchQuery` blockiert den Navigationsabschluss nicht — der Lazy-Chunk und der Datenabruf laufen parallel.

## Out of scope
- Keine Änderung am Canvas-Forecast-Rendering (kein Flackern, In-Place-Redraw).
- Keine Änderung an Farbskala/Bias/Server-Logik.
