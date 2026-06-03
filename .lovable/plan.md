## Problem

1. **Flackern beim Animieren** — Die Radar-Messung-Frames werden als `<ImageOverlay key={...t}>` gerendert. Bei jedem Framewechsel wird das alte Overlay entfernt und das neue gemountet. Das `<img>` muss erst geladen/decodiert werden → kurzes Aufblitzen/Leerframe. Gleicher Effekt beim Hagel-Overlay.
2. **Langsame Ladezeit** — PNGs werden erst beim Anzeigen aus R2 geladen. Beim Scrubben/Play wartet jeder neue Frame auf das Netzwerk.

## Fix

### 1. PNG-Frames vorab in den Browser-Cache laden (`src/components/maps/radar-map.tsx`)
Sobald die Radar-Daten ankommen, in einem `useEffect` alle `precipUrl` und `hailUrl` per `new Image()` parallel anstossen. Der Browser cached & dekodiert sie im Voraus, sodass der spätere Frame-Wechsel sofort sichtbar ist (kein Flackern, kein Warten).

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

### 2. Doppel-Slot-Crossfade für PNG-Frames
Damit beim Framewechsel nie ein leeres Bild sichtbar wird, immer den nächsten Frame als zweites `<ImageOverlay>` mit Opacity 0 vorhalten und beim Wechsel kreuzblenden. Im Pause-Modus snappt es weiterhin auf einen Frame; nur während `playing` läuft der weiche Übergang. Das ersetzt den hartcodierten `blendNextPng = null`:

```ts
const blendNextPng =
  playing && nextFrame?.precipUrl && currentFrame?.precipUrl ? nextFrame : null;
```

So bleibt das alte Bild bis das neue da ist sichtbar → kein Flackern. Da die nächsten Frames durch (1) bereits im Cache liegen, ist der Übergang sofort gerendert.

### 3. Radar-Daten frühzeitig anstossen (`src/routes/karten.radar.tsx`)
`ssr: false` mit `lazy()` bedeutet: Chunk + Daten starten erst nach Mount. In der Route schon vor dem Lazy-Import einen Fetch anstossen:

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

`prefetchQuery` (nicht `ensureQueryData`) blockiert den Navigationsabschluss nicht — der Lazy-Chunk und der Datenabruf laufen parallel, und sobald `RadarMap` mountet ist die Antwort schon (oder gleich) da.

## Out of scope
- Keine Änderung am Canvas-Forecast-Rendering — dort gibt es kein Flackern (ein Canvas, In-Place-Redraw).
- Keine Änderung an Farbskala/Bias/Server-Logik.