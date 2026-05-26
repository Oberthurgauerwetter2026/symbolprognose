## Ziel

1. MeteoSchweiz-Messung (Vergangenheits-Radar) auf die **letzten 6 Stunden** beschränken.
2. Prognose-Frames hart auf **volle Stunden-Buckets** filtern (robuster als die bisherige Minuten-Prüfung).

## Änderungen

### A. Past-Radar auf 6 h begrenzen — `src/lib/radar.functions.ts`

In der Vergangenheits-Schleife (Manifest aus R2) eine Untergrenze einführen:

```ts
const pastCutoff = now - 6 * 3600 * 1000;
if (hasRealRadar) {
  for (const mf of manifest!.frames) {
    const tMs = Date.parse(mf.t);
    if (tMs > now) continue;
    if (tMs < pastCutoff) continue; // NEU
    frames.push({ t: mf.t, source: "radar", values: [], precipUrl: mf.precipUrl, hailUrl: mf.hailUrl });
  }
}
```

### B. Prognose-Stundentakt robuster — `src/lib/radar.functions.ts`

Bestehende Zeile

```ts
if (tMs > now && new Date(tMs).getUTCMinutes() !== 0) continue;
```

ersetzen durch einen exakten Stunden-Bucket-Vergleich:

```ts
if (tMs > now && tMs % (3600 * 1000) !== 0) continue;
```

Damit landen ausschließlich Frames mit `:00`-UTC-Zeitstempel in der Prognose, unabhängig vom genauen ISO-Format.

## Nicht angefasst

- Slider-UI (Ticks, Labels, Snap-Logik, Keyboard) — die Hourly-Logik existiert dort bereits und greift, sobald das Backend nur noch Stunden-Frames liefert.
- Wetterkarte Region, See-Styling, Hagel-Layer, Farbskalen, Filter, Ingest-Skripte, BBox, Cache-TTL.
- Frontend-`useQuery`-Konfiguration (Cache regeneriert sich beim nächsten Lauf automatisch).