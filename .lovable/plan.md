## Ziel

ICON-CH1-Prognose wieder im nativen **15-min-Takt** ausliefern und mit **Cross-Fade-Interpolation** zwischen den Frames flüssig animieren (Optik wie SRF Meteo Radar).

## Änderungen

### A. Stunden-Filter entfernen — `src/lib/radar.functions.ts`

Die Zeile

```ts
if (tMs > now && tMs % (3600 * 1000) !== 0) continue;
```

aus der Phase-1-Schleife (`ref1.time`) ersatzlos löschen. Damit kommen wieder alle ICON-CH1 15-min-Frames bis `forecastCutoff` (+32 h) in die Payload. Past-Cutoff (-6 h MCH) und alles andere bleibt.

### B. Cross-Fade reaktivieren — `src/components/maps/radar-map.tsx`

**`PrecipOverlay`-Signatur:** wieder `nextFrame?: RadarFrame | null` und `progress?: number` annehmen.

**Sampling-Loop:** im bilinearen Sample-Block

```ts
const vCur = sample(vals);
const v = nextVals ? lerp(vCur, sample(nextVals), t) : vCur;
let snowFrac = 0;
if (snowVals) {
  const svCur = sample(snowVals);
  const sv = nextSnowVals ? lerp(svCur, sample(nextSnowVals), t) : svCur;
  if (v > 0.01) snowFrac = Math.max(0, Math.min(1, sv / v));
}
```

mit `t = clamp(progress ?? 0, 0, 1)` und `lerp(a,b,t) = a + (b-a)*t`.

Redraw-Effekt: Dependencies wieder `[frame, nextFrame, progress, payload]`.

**Play-Loop in `RadarMap`:** Statt `setInterval` mit hartem `setIdx` wieder rAF-basiert:

```ts
const [progress, setProgress] = useState(0);

useEffect(() => {
  if (!playing || frames.length === 0) { setProgress(0); return; }
  const FRAME_MS = 800 / speed;
  let raf = 0, last = performance.now();
  const tick = (now: number) => {
    const dt = now - last; last = now;
    setProgress((p) => {
      const np = p + dt / FRAME_MS;
      if (np >= 1) {
        setIdx((cur) => {
          if (cur === null) return 0;
          const next = cur + 1;
          return next >= frames.length ? 0 : next;
        });
        return np - 1;
      }
      return np;
    });
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [playing, speed, frames.length]);
```

**`blendNext` im Body:** Nur zwischen zwei Canvas-Frames (kein `precipUrl`) crossfaden — MCH-PNG-Frames bleiben hartes Switching.

```ts
const currentFrame = idx !== null ? frames[idx] ?? null : null;
const nextFrame =
  idx !== null && playing && currentFrame && !currentFrame.precipUrl
    ? frames[(idx + 1) % frames.length] ?? null
    : null;
const blendNext = nextFrame && !nextFrame.precipUrl ? nextFrame : null;
```

`<PrecipOverlay … nextFrame={blendNext} progress={progress} />` übergeben.

## Nicht angefasst

- 6-h-Past-Cutoff (MCH-Messung) bleibt.
- See vollflächig (`fillOpacity: 1`) bleibt.
- Slider-UI: Stunden-Ticks/Labels bleiben — Snap zum nächstgelegenen Frame ist zeit-basiert und funktioniert weiterhin mit 15-min-Auflösung.
- Hagel-Layer, BBox, Farbskalen, Filter, Edge-Fade, Ingest-Skripte, Region-Karte.

## Hinweis

Echtes Motion-Vector-Morphing (wie sehr aufwändige Radar-Viewer) ist nicht Teil dieses Plans. Lineare Pixel-Interpolation reicht im typischen Karten-Zoom für eine flüssige, SRF-ähnliche Anmutung.