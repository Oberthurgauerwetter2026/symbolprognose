## Ziele

1. **Prognose flüssiger animieren** — zwischen den 15-min-Frames temporal interpolieren, damit die Wiedergabe weich morpht statt zu springen. möglich im 5 min-Takt?
2. **Niederschlag über dem See sichtbar** — Lake-Layer hinter das Precip-Overlay legen, damit Ns auch über dem Bodensee farbig erscheint.

## Änderungen — `src/components/maps/radar-map.tsx`

### A. Zwischen-Frames sanft cross-faden (Prognose)

Aktuell schaltet die Animation hart zwischen 15-min-Frames um (`setInterval`, `setIdx(cur+1)`). Mit ICON-CH1 sind das alle 400 ms (1×) ein Sprung.

Neuer Ansatz im `PrecipOverlay`:

- Statt nur des aktuellen Frames bekommt das Overlay `**frame` + `nextFrame` + `progress` (0…1)**.
- In der bilinearen Sample-Schleife wird `v = lerp(currentV, nextV, progress)` und analog `snowV` gemischt.
- `RadarMap` führt einen zusätzlichen `subProgress`-State (0…1) ein:
  - Beim Play wird `subProgress` per `requestAnimationFrame` zwischen 0 und 1 hochgezählt; bei 1 → `idx++`, `subProgress = 0`.
  - Beim Pause/Scrub bleibt `subProgress = 0`.
- Tween-Dauer = `400 ms / speed` (entspricht der bisherigen Frame-Dauer), Wiedergabe wird damit nicht schneller, nur weicher.

Folge: Ns-Felder „fliessen" durch die Karte, statt zu blitzen.

### B. Lake unter den Niederschlag legen

Aktuell-Reihenfolge in JSX:

```
TileLayer → OUTSIDE_CH_MASK → OUTSIDE_MASK → LAKE → SWITZERLAND → THURGAU → Precip
```

Leaflet stapelt SVG-GeoJSON in einer gemeinsamen `<svg>` im `overlayPane`. Wenn das Precip-`<canvas>`/`<img>` später hinzukommt, *müsste* es darüber liegen — tut es aber visuell nicht, weil das Lake-Polygon mit `fillOpacity: 1` opak ist und beim Re-Render der React-Leaflet-Children manchmal nach der ImageOverlay wieder vorgehängt wird (gleicher Pane, gleiche svg-Wurzel, Reihenfolge des letzten `addLayer`-Calls gewinnt).

Fix in zwei Schritten:

1. **Lake in einen dedizierten Pane unter dem Overlay legen.**
  In einem kleinen `LakePane`-Helper (eigene Komponente, ähnlich `InvalidateOnResize`):
   GeoJSON für `LAKE` bekommt `pane="lake"`.
2. **Lake-Füllung leicht durchscheinend lassen.**
  `fillOpacity: 1` → `fillOpacity: 0.92`. Plus der eigene Pane garantiert, dass die Precip-Overlays (Canvas + MCH-PNG, Pane = overlayPane, z-index 400) immer darüber liegen.

So bleibt das See-Blau erkennbar, ein darüber liegender Regen-/Schnee-Blob wird aber farbig durchscheinend sichtbar.

## Was sich NICHT ändert

- Datenpipeline (`radar.functions.ts`, Ingest, Cron).
- Frame-Quellen, BBox, Legende, Hagel.
- Farb-Skalen, Filter, BUFFER, Edge-Fade.
- Touch-/Keyboard-Steuerung der Timeline.