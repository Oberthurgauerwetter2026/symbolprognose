import { useEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

import { useQuery } from "@tanstack/react-query";
import {
  MapContainer,
  GeoJSON,
  Marker,
  TileLayer,
  ZoomControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { attachCanvasZoomAnim, detachCanvasZoomAnim } from "./canvas-zoom-anim";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { Pause, Play, ChevronLeft, ChevronRight, Settings, Clock, Info, X, Zap } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";


import regionData from "@/data/region.json";
import lakeData from "@/data/lake.json";
import switzerlandData from "@/data/switzerland.json";
import thurgauData from "@/data/thurgau.json";

import { type RadarPayload, type RadarFrame } from "@/lib/radar.functions";
import { getLightningStrikes, type LightningStrike } from "@/lib/lightning.functions";
import { radarFramesQuery } from "@/lib/map-queries";
import { cn } from "@/lib/utils";
import { FilmstripTimeline } from "./filmstrip-timeline";
import { CityMarkers } from "./city-markers";





const BRAND = "#2561a1";
const MEASUREMENT_COLOR = "#1f7a3a";
const FORECAST_COLOR = BRAND;
const FILMSTRIP_MEASUREMENT_COLOR = "#9ca3af";
const FILMSTRIP_FORECAST_COLOR = BRAND;
const REGION = regionData as unknown as FeatureCollection;
const LAKE = lakeData as unknown as FeatureCollection;
const SWITZERLAND = switzerlandData as unknown as FeatureCollection;
const THURGAU = thurgauData as unknown as FeatureCollection;



// Niederschlags-Farbskala (mm/h) — MeteoSchweiz-CombiPrecip-Reset.
// MUSS exakt zu PRECIP_SCALE in scripts/ingest_radar.py passen
// (gleiche Schwellen + RGBA), damit Messung-PNG und Forecast-Canvas
// identisch aussehen. Alpha hier 0..1; die finale Deckkraft setzt die
// einheitliche ImageOverlay-/Canvas-`opacity` im Frontend.
const SCALE: { mmh: number; rgb: [number, number, number]; a: number }[] = [
  { mmh: 0.1,   rgb: [150, 195, 235], a: 235 / 255 },
  { mmh: 0.3,   rgb: [ 95, 155, 220], a: 255 / 255 },
  { mmh: 0.8,   rgb: [ 40,  90, 195], a: 255 / 255 },
  { mmh: 2,     rgb: [ 55, 170,  75], a: 255 / 255 },
  { mmh: 5,     rgb: [245, 220,  55], a: 255 / 255 },
  { mmh: 15,    rgb: [240, 140,  35], a: 255 / 255 },
  { mmh: 40,    rgb: [220,  40,  40], a: 255 / 255 },
  { mmh: 80,    rgb: [170,  40, 180], a: 255 / 255 },
];

function colorFor(mmh: number): [number, number, number, number] {
  // Quantisierte harte Bänder — gibt scharfe Iso-Konturen wie auf MCH-CombiPrecip.
  if (mmh < SCALE[0].mmh) return [0, 0, 0, 0];
  let band = SCALE[0];
  for (let i = SCALE.length - 1; i >= 0; i--) {
    if (mmh >= SCALE[i].mmh) {
      band = SCALE[i];
      break;
    }
  }
  return [band.rgb[0], band.rgb[1], band.rgb[2], band.a];
}








// Schnee-Farbskala (mm/h Wasser-Äquivalent) — MeteoSchweiz: leicht / stark.
const SNOW_SCALE: { mmh: number; rgb: [number, number, number]; label: string }[] = [
  { mmh: 0.1, rgb: [205, 195, 230], label: "leicht" },
  { mmh: 2, rgb: [150, 60, 200], label: "stark" },
];

function snowColorFor(mmh: number): [number, number, number, number] {
  if (mmh < SNOW_SCALE[0].mmh) return [0, 0, 0, 0];
  for (let i = SNOW_SCALE.length - 1; i >= 0; i--) {
    if (mmh >= SNOW_SCALE[i].mmh) {
      const [r, g, b] = SNOW_SCALE[i].rgb;
      const a = 0.85;
      return [r, g, b, a];
    }
  }
  return [0, 0, 0, 0];
}

const OUTSIDE_MASK: FeatureCollection = (() => {
  const holes: number[][][] = [];
  const collect = (fc: FeatureCollection) => {
    for (const f of fc.features) {
      const g = f.geometry;
      if (!g) continue;
      if (g.type === "Polygon" && g.coordinates[0]) holes.push(g.coordinates[0]);
      else if (g.type === "MultiPolygon") for (const p of g.coordinates) if (p[0]) holes.push(p[0]);
    }
  };
  collect(REGION);
  collect(LAKE);
  const world = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  const feat: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [world, ...holes] },
  };
  return { type: "FeatureCollection", features: [feat] };
})();

const REGION_OUTLINE: FeatureCollection = (() => {
  const rings: number[][][] = [];
  for (const f of REGION.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon") for (const r of g.coordinates) rings.push(r);
    else if (g.type === "MultiPolygon")
      for (const p of g.coordinates) for (const r of p) rings.push(r);
  }
  const key = (p: number[]) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  const segKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const count = new Map<string, number>();
  for (const r of rings) {
    for (let i = 0; i < r.length - 1; i++) {
      const k = segKey(key(r[i]), key(r[i + 1]));
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  // outer edges = count === 1; build adjacency on point keys
  const adj = new Map<string, Map<string, number[]>>();
  const pt = new Map<string, number[]>();
  for (const r of rings) {
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i];
      const b = r[i + 1];
      const ka = key(a);
      const kb = key(b);
      if (count.get(segKey(ka, kb)) !== 1) continue;
      pt.set(ka, a);
      pt.set(kb, b);
      if (!adj.has(ka)) adj.set(ka, new Map());
      if (!adj.has(kb)) adj.set(kb, new Map());
      adj.get(ka)!.set(kb, b);
      adj.get(kb)!.set(ka, a);
    }
  }
  const lines: number[][][] = [];
  const visited = new Set<string>();
  const edgeKey = (a: string, b: string) => segKey(a, b);
  for (const start of adj.keys()) {
    for (const [next] of adj.get(start)!) {
      const ek = edgeKey(start, next);
      if (visited.has(ek)) continue;
      const line: number[][] = [pt.get(start)!];
      let prev = start;
      let cur = next;
      visited.add(ek);
      line.push(pt.get(cur)!);
      while (true) {
        const neighbors = adj.get(cur);
        if (!neighbors) break;
        let nx: string | null = null;
        for (const [n] of neighbors) {
          if (n === prev) continue;
          if (visited.has(edgeKey(cur, n))) continue;
          nx = n;
          break;
        }
        if (!nx) break;
        visited.add(edgeKey(cur, nx));
        line.push(pt.get(nx)!);
        prev = cur;
        cur = nx;
        if (cur === start) break;
      }
      lines.push(line);
    }
  }
  const feat: Feature = {
    type: "Feature",
    properties: {},
    geometry: { type: "MultiLineString", coordinates: lines },
  };
  return { type: "FeatureCollection", features: [feat] };
})();

const OUTSIDE_CH_MASK: FeatureCollection = (() => {
  const holes: number[][][] = [];
  const collect = (fc: FeatureCollection) => {
    for (const f of fc.features) {
      const g = f.geometry;
      if (!g) continue;
      if (g.type === "Polygon" && g.coordinates[0]) holes.push(g.coordinates[0]);
      else if (g.type === "MultiPolygon") for (const p of g.coordinates) if (p[0]) holes.push(p[0]);
    }
  };
  collect(SWITZERLAND);
  collect(LAKE);
  const world = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  const feat: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [world, ...holes] },
  };
  return { type: "FeatureCollection", features: [feat] };
})();

const regionBounds: L.LatLngBoundsExpression = [
  [47.4744785, 9.1771913],
  [47.6392538, 9.4773698],
];

// Exakt die Daten-Bbox: so liegt die harte Datenkante immer knapp aussen am
// Kartenrand und wirkt nicht abgeschnitten.
const maxBoundsExt: L.LatLngBoundsExpression = [
  [46.85, 8.15],
  [48.3, 10.55],
];


function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const fit = () => map.invalidateSize();
    fit();
    window.addEventListener("resize", fit);
    const ro = new ResizeObserver(fit);
    ro.observe(map.getContainer());
    return () => {
      window.removeEventListener("resize", fit);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

function useMapZoom(): number {
  const map = useMap();
  const [z, setZ] = useState<number>(() => map.getZoom());
  useEffect(() => {
    const update = () => setZ(map.getZoom());
    map.on("zoomend zoom", update);
    update();
    return () => {
      map.off("zoomend zoom", update);
    };
  }, [map]);
  return z;
}

function ZoomGate({ minZoom, children }: { minZoom: number; children: React.ReactNode }) {
  const z = useMapZoom();
  if (z < minZoom) return null;
  return <>{children}</>;
}

function toLeafletBounds(bounds: L.LatLngBoundsExpression): L.LatLngBounds {
  return bounds instanceof L.LatLngBounds
    ? bounds
    : L.latLngBounds(bounds as L.LatLngExpression[]);
}

function StableImageOverlay({
  url,
  bounds,
  opacity,
  zIndex,
  className,
}: {
  url: string;
  bounds: L.LatLngBoundsExpression;
  opacity: number;
  zIndex?: number;
  className?: string;
}) {
  const map = useMap();
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const latestUrlRef = useRef(url);

  useEffect(() => {
    const overlay = L.imageOverlay(url, toLeafletBounds(bounds), { opacity, zIndex, className }).addTo(map);
    overlayRef.current = overlay;
    latestUrlRef.current = url;
    return () => {
      overlay.remove();
      overlayRef.current = null;
    };
    // Leaflet layer stays mounted; frame changes use setUrl after preload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.setBounds(toLeafletBounds(bounds));
    overlay.setOpacity(opacity);
    if (typeof zIndex === "number") overlay.setZIndex(zIndex);
  }, [bounds, opacity, zIndex]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || latestUrlRef.current === url) return;
    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (cancelled) return;
      latestUrlRef.current = url;
      overlay.setUrl(url);
    };
    img.onerror = () => {
      if (cancelled) return;
      latestUrlRef.current = url;
      overlay.setUrl(url);
    };
    img.src = url;
    if (img.complete) {
      latestUrlRef.current = url;
      overlay.setUrl(url);
    }
    return () => {
      cancelled = true;
    };
  }, [url]);

  return null;
}



function nearestFrameIndexForMs(frames: RadarFrame[], targetMs: number): number {
  if (frames.length === 0) return 0;
  let best = 0;
  let bestDt = Infinity;
  for (let i = 0; i < frames.length; i++) {
    const dt = Math.abs(Date.parse(frames[i].t) - targetMs);
    if (dt < bestDt) {
      bestDt = dt;
      best = i;
    }
  }
  return best;
}

function bracketFramesForMs(
  frames: RadarFrame[],
  targetMs: number,
  predicate?: (frame: RadarFrame) => boolean,
): { frame: RadarFrame | null; nextFrame: RadarFrame | null; progress: number } {
  const eligible = predicate ? frames.filter(predicate) : frames;
  if (eligible.length === 0) return { frame: null, nextFrame: null, progress: 0 };
  if (eligible.length === 1) return { frame: eligible[0], nextFrame: null, progress: 0 };

  const firstMs = Date.parse(eligible[0].t);
  if (targetMs <= firstMs) return { frame: eligible[0], nextFrame: eligible[1], progress: 0 };

  const last = eligible[eligible.length - 1];
  const lastMs = Date.parse(last.t);
  if (targetMs >= lastMs) return { frame: last, nextFrame: null, progress: 0 };

  for (let i = 0; i < eligible.length - 1; i++) {
    const a = eligible[i];
    const b = eligible[i + 1];
    const aMs = Date.parse(a.t);
    const bMs = Date.parse(b.t);
    if (targetMs >= aMs && targetMs <= bMs) {
      const span = Math.max(1, bMs - aMs);
      return {
        frame: a,
        nextFrame: b,
        progress: Math.max(0, Math.min(1, (targetMs - aMs) / span)),
      };
    }
  }

  const idx = nearestFrameIndexForMs(eligible, targetMs);
  return { frame: eligible[idx], nextFrame: eligible[idx + 1] ?? null, progress: 0 };
}

/**
 * Fade-Gewichtung innerhalb eines Zeitschritts: Das Feld hält den Grossteil
 * des Schritts unverändert (Gewicht 0) und geht erst im letzten Abschnitt
 * weich (höherwertiger Smoothstep) in das nächste Feld über. Grösseres
 * Blend-Fenster als früher, damit der Stundenwechsel ruhiger wirkt.
 */
function fadeWeight(progress: number, frac = 0.55): number {
  const p = Math.max(0, Math.min(1, progress));
  if (frac <= 0) return p >= 1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (p - (1 - frac)) / frac));
  // Höherwertiger Smoothstep (Perlin): flachere Anfangs-/End-Phase, ruhigerer Übergang.
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function timelineStateForMs(
  frames: RadarFrame[],
  renderMs: number,
) {
  const all = bracketFramesForMs(frames, renderMs);
  const displayIdx = nearestFrameIndexForMs(frames, renderMs);

  return {
    renderMs,
    displayIdx,
    frame: all.frame,
    nextFrame: all.nextFrame,
    progress: all.progress,
  };
}

/**
 * Canvas-Overlay-Layer, der ein Niederschlags-Grid mit bilinearer Interpolation
 * über die Karte rendert. Updates per setFrame() ohne Layer-Neuaufbau.
 */
function PrecipOverlay({
  payload,
  frame,
  nextFrame,
  progress,
  opacity = 1,
  prewarmFrames,
}: {
  payload: RadarPayload;
  frame: RadarFrame | null;
  nextFrame?: RadarFrame | null;
  progress?: number;
  opacity?: number;
  prewarmFrames?: RadarFrame[];
}) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<L.Layer | null>(null);

  // Advektives Resampling wurde entfernt — pro Framepaar wechselnde Shift-
  // Vektoren liessen die Prognose-Bänder sichtbar wackeln. Jetzt wird nur noch
  // die Intensität der beiden benachbarten Datenframes interpoliert.




  // Canvas-Layer einmalig anlegen.
  useEffect(() => {
    const CanvasLayer = L.Layer.extend({
      onAdd(this: L.Layer & { _canvas?: HTMLCanvasElement }) {
        const pane = map.getPanes().overlayPane;
        const cv = L.DomUtil.create("canvas", "radar-canvas") as HTMLCanvasElement;
        cv.style.position = "absolute";
        cv.style.pointerEvents = "none";
        cv.style.willChange = "transform";
        cv.style.opacity = "1";
        cv.style.zIndex = "440";
        // Beide Layer (Messung-Fallback und Prognose) bekommen denselben
        // leichten Kontrast wie das MCH-PNG (.mch-precip), damit Farbskala
        // und Wahrnehmung über alle Quellen hinweg konsistent bleiben.
        cv.style.filter = "contrast(1.1)";
        (cv.style as unknown as { imageRendering: string }).imageRendering = "auto";

        pane.appendChild(cv);
        this._canvas = cv;
        canvasRef.current = cv;
        map.on("moveend resize", redraw);
        attachCanvasZoomAnim(map, cv, redraw);
        redraw();
        return this;
      },
      onRemove(this: L.Layer & { _canvas?: HTMLCanvasElement }) {
        if (this._canvas) this._canvas.remove();
        map.off("moveend resize", redraw);
        detachCanvasZoomAnim(this._canvas);
        canvasRef.current = null;
        return this;
      },
    });

    const layer = new (CanvasLayer as unknown as new () => L.Layer)();
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Frame-Canvas-Cache: pro Frame wird das fertige Low-Res-Bild einmal
  // gerendert und gecacht; Scrub/Play blittet nur noch. Optik unverändert.
  const cacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const viewKeyRef = useRef<string>("");
  const lookupRef = useRef<{
    key: string;
    lowW: number;
    lowH: number;
    fx: Float32Array;
    fy: Float32Array;
    valid: Uint8Array;
    contourScale?: Float32Array;
  } | null>(null);
  const CACHE_MAX = 512;

  // Timeline-Refs: nextFrame + progress werden pro Animation-Tick als Prop
  // gesetzt; redrawRef liest sie über Refs, damit Play/Scrub dieselbe
  // kontinuierliche Zeitachse nutzen.
  const nextFrameRef = useRef<RadarFrame | null>(null);
  const progressRef = useRef<number>(0);
  


  const redrawRef = useRef<() => void>(() => {});
  const redrawScheduledRef = useRef<number | null>(null);
  function redraw() {
    if (redrawScheduledRef.current !== null) return;
    redrawScheduledRef.current = requestAnimationFrame(() => {
      redrawScheduledRef.current = null;
      redrawRef.current();
    });
  }
  // Cache-Invalidierung passiert im Redraw über den View-Key (Zoom, Grösse,
  // DPR, Center). Ein Leeren bereits bei `zoomstart`/`movestart` würde das
  // Bild während der Bewegung entwerten und den Redraw danach verzögern.


  redrawRef.current = () => {
    const cv = canvasRef.current;
    if (!cv || !frame) return;
    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;
    cv.width = size.x * dpr;
    cv.height = size.y * dpr;
    cv.style.width = size.x + "px";
    cv.style.height = size.y + "px";
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(cv, topLeft);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);

    const { gridLat, gridLon } = payload;
    const nLat = gridLat.length;
    const nLon = gridLon.length;
    // Prognose- und Mess-Frames werden identisch gerendert: keine zusätzliche
    // Glättung für die Prognose, damit Kanten und Bandgrössen gleich wirken.
    const rawVals = frame.values;
    const rawSnow = frame.snowValues;
    const vals = rawVals;
    const snowVals = rawSnow;

    if (!vals || vals.length === 0) return;

    // Weicher Übergang zum nächsten Feld: rein gewichtete Mischung der
    // Intensitäten (keine Geometrieverformung, keine geschätzte Bewegung).
    // `progress` liefert bereits die Fade-Gewichtung (0 = Feld hält stabil).
    const nf = nextFrameRef.current;
    const QSTEPS = 24;
    const nextValsRaw =
      nf && Array.isArray(nf.values) && nf.values.length === vals.length ? nf.values : null;
    const wRaw = Math.max(0, Math.min(1, progressRef.current || 0));
    const blendW = nextValsRaw ? Math.round(wRaw * QSTEPS) / QSTEPS : 0;
    const nextVals = blendW > 0 ? nextValsRaw : null;
    const nextSnow =
      nextVals && nf && Array.isArray(nf.snowValues) && nf.snowValues.length === vals.length
        ? nf.snowValues
        : null;
    const STEP = 2;
    const lowWForView = Math.max(1, Math.ceil(size.x / STEP));
    const lowHForView = Math.max(1, Math.ceil(size.y / STEP));

    // View-Key — Cache invalidiert bei Pan/Zoom/Resize/DPR-Wechsel.
    const center = map.getCenter();
    const viewKey = `${map.getZoom()}|${size.x}x${size.y}|${dpr}|${center.lat.toFixed(4)}|${center.lng.toFixed(4)}|${STEP}`;
    if (viewKey !== viewKeyRef.current) {
      cacheRef.current.clear();
      lookupRef.current = null;
      viewKeyRef.current = viewKey;
    }

    let lookup = lookupRef.current;
    if (!lookup || lookup.key !== viewKey) {
      const fx = new Float32Array(lowWForView * lowHForView);
      const fy = new Float32Array(lowWForView * lowHForView);
      const valid = new Uint8Array(lowWForView * lowHForView);

      for (let ly = 0; ly < lowHForView; ly++) {
        for (let lx = 0; lx < lowWForView; lx++) {
          const cell = ly * lowWForView + lx;
          const px = lx * STEP;
          const py = ly * STEP;
          const ll = map.containerPointToLatLng([px, py]);
          const fxRaw = ((ll.lng - gridLon[0]) / (gridLon[nLon - 1] - gridLon[0])) * (nLon - 1);
          const fyRaw = ((ll.lat - gridLat[0]) / (gridLat[nLat - 1] - gridLat[0])) * (nLat - 1);
          const BUFFER = 3;
          if (fxRaw < -BUFFER || fxRaw > nLon - 1 + BUFFER) continue;
          if (fyRaw < -BUFFER || fyRaw > nLat - 1 + BUFFER) continue;
          fx[cell] = fxRaw;
          fy[cell] = fyRaw;
          valid[cell] = 1;
        }
      }
      lookup = { key: viewKey, lowW: lowWForView, lowH: lowHForView, fx, fy, valid };
      lookupRef.current = lookup;
    }


    const cacheKey = `${frame.t}|${frame.source ?? ""}${
      nextVals ? `>${nf?.t ?? ""}@${blendW}` : ""
    }`;
    let off = cacheRef.current.get(cacheKey) ?? null;
    let lowW: number;
    let lowH: number;

    if (off) {
      // LRU-Touch.
      cacheRef.current.delete(cacheKey);
      cacheRef.current.set(cacheKey, off);
      lowW = off.width;
      lowH = off.height;
    } else {
      lowW = lookup.lowW;
      lowH = lookup.lowH;

      const img = ctx.createImageData(lowW, lowH);
      const data = img.data;

      // Bilineare Sample-Funktion.
      const sampleAt = (arr: number[], fx: number, fy: number) => {
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const x1 = x0 + 1;
        const y1 = y0 + 1;
        const txL = fx - x0;
        const tyL = fy - y0;
        const inX0 = x0 >= 0 && x0 < nLon;
        const inX1 = x1 >= 0 && x1 < nLon;
        const inY0 = y0 >= 0 && y0 < nLat;
        const inY1 = y1 >= 0 && y1 < nLat;
        if ((!inX0 && !inX1) || (!inY0 && !inY1)) return 0;
        const v00 = inX0 && inY0 ? arr[y0 * nLon + x0] : 0;
        const v01 = inX1 && inY0 ? arr[y0 * nLon + x1] : 0;
        const v10 = inX0 && inY1 ? arr[y1 * nLon + x0] : 0;
        const v11 = inX1 && inY1 ? arr[y1 * nLon + x1] : 0;
        return (
          v00 * (1 - txL) * (1 - tyL) +
          v01 * txL * (1 - tyL) +
          v10 * (1 - txL) * tyL +
          v11 * txL * tyL
        );
      };

      for (let ly = 0; ly < lowH; ly++) {
        for (let lx = 0; lx < lowW; lx++) {
          const cell = ly * lowW + lx;
          if (!lookup.valid[cell]) continue;
          const fxRaw = lookup.fx[cell];
          const fyRaw = lookup.fy[cell];

          const sx = fxRaw;
          const sy = fyRaw;

          let v = sampleAt(vals, sx, sy);
          if (nextVals) v = v * (1 - blendW) + sampleAt(nextVals, sx, sy) * blendW;

          const minV = 0.1;
          if (v < minV) continue;

          let snowFrac = 0;
          if (snowVals) {
            let sv = sampleAt(snowVals, sx, sy);
            if (nextSnow) sv = sv * (1 - blendW) + sampleAt(nextSnow, sx, sy) * blendW;
            if (v > 0.01) snowFrac = Math.max(0, Math.min(1, sv / v));
          }

          const [r, g, b, a] = snowFrac > 0.3
            ? snowColorFor(v)
            : colorFor(v);
          if (a === 0) continue;
          const alpha = Math.round(a * 255);
          if (alpha === 0) continue;
          const idx = (ly * lowW + lx) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = alpha;
        }
      }

      off = document.createElement("canvas");
      off.width = lowW;
      off.height = lowH;
      const offCtx = off.getContext("2d");
      if (!offCtx) return;
      offCtx.putImageData(img, 0, 0);

      cacheRef.current.set(cacheKey, off);
      while (cacheRef.current.size > CACHE_MAX) {
        const firstKey = cacheRef.current.keys().next().value;
        if (firstKey === undefined) break;
        cacheRef.current.delete(firstKey);
      }
    }

    // Crossfade/Optical-Flow-Blend deaktiviert — Prognose wechselt hart wie die Messung.

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, 0, 0, lowW, lowH, 0, 0, size.x, size.y);
    ctx.restore();
  };


  // Frame off-screen rendern und in `cacheRef` ablegen (ohne sichtbare Canvas
  // anzufassen). Wird vom Pre-Warm verwendet, damit Scrub/Play später nur
  // noch blitten — kein Lazy-Render-Stocker beim ersten Anzeigen eines Frames.
  const buildOffscreenRef = useRef<(f: RadarFrame) => HTMLCanvasElement | null>(() => null);
  buildOffscreenRef.current = (f: RadarFrame): HTMLCanvasElement | null => {
    const lookup = lookupRef.current;
    if (!lookup) return null;
    const cacheKey = `${f.t}|${f.source ?? ""}`;
    const existing = cacheRef.current.get(cacheKey);
    if (existing) return existing;
    const { gridLat, gridLon } = payload;
    const nLat = gridLat.length;
    const nLon = gridLon.length;
    // Identische Optik für Messung und Prognose — keine Zusatzglättung.

    const rawVals = f.values;
    const rawSnow = f.snowValues;
    if (!rawVals || rawVals.length === 0) return null;
    const vals = rawVals;
    const snowVals = rawSnow;

    if (!vals || vals.length === 0) return null;
    const lowW = lookup.lowW;
    const lowH = lookup.lowH;
    const off = document.createElement("canvas");
    off.width = lowW;
    off.height = lowH;
    const offCtx = off.getContext("2d");
    if (!offCtx) return null;
    const img = offCtx.createImageData(lowW, lowH);
    const data = img.data;
    const sampleAt = (arr: number[], fx: number, fy: number) => {
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const txL = fx - x0;
      const tyL = fy - y0;
      const inX0 = x0 >= 0 && x0 < nLon;
      const inX1 = x1 >= 0 && x1 < nLon;
      const inY0 = y0 >= 0 && y0 < nLat;
      const inY1 = y1 >= 0 && y1 < nLat;
      if ((!inX0 && !inX1) || (!inY0 && !inY1)) return 0;
      const v00 = inX0 && inY0 ? arr[y0 * nLon + x0] : 0;
      const v01 = inX1 && inY0 ? arr[y0 * nLon + x1] : 0;
      const v10 = inX0 && inY1 ? arr[y1 * nLon + x0] : 0;
      const v11 = inX1 && inY1 ? arr[y1 * nLon + x1] : 0;
      return (
        v00 * (1 - txL) * (1 - tyL) +
        v01 * txL * (1 - tyL) +
        v10 * (1 - txL) * tyL +
        v11 * txL * tyL
      );
    };
    for (let ly = 0; ly < lowH; ly++) {
      for (let lx = 0; lx < lowW; lx++) {
        const cell = ly * lowW + lx;
        if (!lookup.valid[cell]) continue;
        const fxRaw = lookup.fx[cell];
        const fyRaw = lookup.fy[cell];
        const sx = fxRaw;
        const sy = fyRaw;
        let v = sampleAt(vals, sx, sy);
        const minV = 0.1;
        if (v < minV) continue;
        let snowFrac = 0;
        if (snowVals) {
          const sv = sampleAt(snowVals, sx, sy);
          if (v > 0.01) snowFrac = Math.max(0, Math.min(1, sv / v));
        }
        const [r, g, b, a] = snowFrac > 0.3
          ? snowColorFor(v)
          : colorFor(v);
        if (a === 0) continue;
        const alpha = Math.round(a * 255);
        if (alpha === 0) continue;
        const px = (ly * lowW + lx) * 4;
        data[px] = r;
        data[px + 1] = g;
        data[px + 2] = b;
        data[px + 3] = alpha;
      }
    }
    offCtx.putImageData(img, 0, 0);
    cacheRef.current.set(cacheKey, off);
    while (cacheRef.current.size > CACHE_MAX) {
      const firstKey = cacheRef.current.keys().next().value;
      if (firstKey === undefined) break;
      cacheRef.current.delete(firstKey);
    }
    return off;
  };


  // Frame-/Payload-Wechsel neu zeichnen.
  useEffect(() => {
    redraw();
  }, [frame, payload]);

  // Pre-Warm: nach Map-Idle alle Cadence-Frames off-screen vorberechnen,
  // damit Scrubbing/Play instant blittet (kein Lazy-Render). Bricht ab,
  // sobald die View wechselt (movestart/zoomstart leert den Cache).
  useEffect(() => {
    if (!prewarmFrames || prewarmFrames.length === 0) return;
    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (h: number) => void;
    };
    const schedule = (cb: () => void) => {
      if (w.requestIdleCallback) {
        idleHandle = w.requestIdleCallback(cb, { timeout: 200 });
      } else {
        timeoutHandle = setTimeout(cb, 0);
      }
    };
    const clearScheduled = () => {
      if (idleHandle !== null && w.cancelIdleCallback) {
        w.cancelIdleCallback(idleHandle);
        idleHandle = null;
      }
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    let i = 0;
    const step = () => {
      if (cancelled) return;
      // Warten bis Lookup-Tabelle steht (nach erstem redraw).
      if (!lookupRef.current) {
        timeoutHandle = setTimeout(step, 80);
        return;
      }
      const f = prewarmFrames[i];
      if (f && (f.values?.length ?? 0) > 0) {
        buildOffscreenRef.current(f);
      }
      i++;
      if (i < prewarmFrames.length) {
        schedule(step);
      }
    };

    const start = () => {
      i = 0;
      clearScheduled();
      schedule(step);
    };

    const reset = () => {
      clearScheduled();
      // Cache wird durch zoomstart/movestart-Handler bereits geleert;
      // hier nur neu starten, sobald die Map ruht.
    };

    map.on("movestart zoomstart resize", reset);
    map.on("moveend zoomend", start);
    // Initial nach kurzem Delay (lässt initialen redraw zuerst laufen).
    timeoutHandle = setTimeout(start, 120);

    return () => {
      cancelled = true;
      clearScheduled();
      map.off("movestart zoomstart resize", reset);
      map.off("moveend zoomend", start);
    };
  }, [prewarmFrames, payload, map]);



  // Timeline-Sync: nextFrame/progress in Refs spiegeln und Redraw triggern.
  useEffect(() => {
    nextFrameRef.current = nextFrame ?? null;
    progressRef.current = typeof progress === "number" ? progress : 0;
    redraw();
  }, [nextFrame, progress]);

  // Canvas-Opacity nachziehen.
  useEffect(() => {
    const cv = canvasRef.current;
    if (cv) cv.style.opacity = String(Math.max(0, Math.min(1, opacity)));
  }, [opacity]);

  return null;
}

/**
 * Messungs-PNG (MCH CombiPrecip) → Canvas-Layer mit identischer Optik wie
 * `PrecipOverlay` der Prognose: PNG wird einmalig zu einem mm/h-Grid decodiert
 * (RGB → nächste SCALE-Bande), beim Rendern bilinear über Lat/Lon gesampelt
 * und mit harten Farbbändern (`colorFor`) gezeichnet. Kein Glätten, kein Blur.
 */
function MeasurementCanvasOverlay({
  url,
  nextUrl,
  blend = 0,
  bounds,
  opacity,
  prefetchUrls,
}: {
  url: string;
  /** Zielfeld des weichen Übergangs (optional). */
  nextUrl?: string | null;
  /** Gewicht von `nextUrl` (0 = nur `url`, 1 = nur `nextUrl`). */
  blend?: number;
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  opacity: number;
  prefetchUrls?: string[];
}) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<L.Layer | null>(null);
  // `band` = Index der Farbstufe (0 = kein Niederschlag, 1…SCALE.length).
  // Interpolation/Glättung laufen über den Bandindex, nicht über den
  // quantisierten mm/h-Wert — sonst kippen Pixel innerhalb einer Fläche in
  // die Nachbarfarbe (Farbpunkt-Artefakt).
  type DecodedRadar = {
    w: number;
    h: number;
    mmh: Float32Array;
    band: Float32Array;
    smoothBand?: Float32Array;
  };
  const sourceRef = useRef<DecodedRadar | null>(null);
  const cacheRef = useRef<Map<string, DecodedRadar>>(new Map());
  const DECODE_CACHE_MAX = 96;
  // Unused payload placeholder for redraw signature (kept to avoid churn).
  const payload: RadarPayload | undefined = undefined;
  void payload;


  const redrawRef = useRef<() => void>(() => {});
  const redrawScheduledRef = useRef<number | null>(null);
  function redraw() {
    if (redrawScheduledRef.current !== null) return;
    redrawScheduledRef.current = requestAnimationFrame(() => {
      redrawScheduledRef.current = null;
      redrawRef.current();
    });
  }

  const ensureSmooth = (src: DecodedRadar): Float32Array => {
    if (src.smoothBand) return src.smoothBand;
    const sw = src.w;
    const sh = src.h;
    const smooth = new Float32Array(sw * sh);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        let sum = 0;
        let cnt = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= sh) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= sw) continue;
            sum += src.band[yy * sw + xx];
            cnt++;
          }
        }
        smooth[y * sw + x] = cnt > 0 ? sum / cnt : 0;
      }
    }
    src.smoothBand = smooth;
    return smooth;
  };

  useEffect(() => {
    const CanvasLayer = L.Layer.extend({
      onAdd(this: L.Layer & { _canvas?: HTMLCanvasElement }) {
        const pane = map.getPanes().overlayPane;
        const cv = L.DomUtil.create("canvas", "radar-canvas") as HTMLCanvasElement;
        cv.style.position = "absolute";
        cv.style.pointerEvents = "none";
        cv.style.willChange = "transform";
        cv.style.zIndex = "460";
        cv.style.filter = "contrast(1.1)";


        pane.appendChild(cv);
        this._canvas = cv;
        canvasRef.current = cv;
        map.on("moveend resize", redraw);
        attachCanvasZoomAnim(map, cv, redraw);
        redraw();
        return this;
      },
      onRemove(this: L.Layer & { _canvas?: HTMLCanvasElement }) {
        if (this._canvas) this._canvas.remove();
        map.off("moveend resize", redraw);
        detachCanvasZoomAnim(this._canvas);
        canvasRef.current = null;
        return this;
      },
    });
    const layer = new (CanvasLayer as unknown as new () => L.Layer)();
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // PNG → mm/h-Grid decoding mit LRU-Cache pro Quell-URL. Aktuelles und
  // Zielfeld werden beide dekodiert, damit der weiche Übergang ohne
  // Nachladepause (und damit ohne Aufblitzen) läuft.
  useEffect(() => {
    let cancelled = false;
    const decode = (u: string) => {
      const cached = cacheRef.current.get(u);
      if (cached) {
        // Reinsert to mark as recent.
        cacheRef.current.delete(u);
        cacheRef.current.set(u, cached);
        if (u === url) sourceRef.current = cached;
        redraw();
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => {
        if (cancelled) return;
        const cw = img.naturalWidth;
        const ch = img.naturalHeight;
        if (cw === 0 || ch === 0) return;
        const c = document.createElement("canvas");
        c.width = cw;
        c.height = ch;
        const cx = c.getContext("2d", { willReadFrequently: true });
        if (!cx) return;
        cx.drawImage(img, 0, 0);
        let data: Uint8ClampedArray;
        try {
          data = cx.getImageData(0, 0, cw, ch).data;
        } catch {
          return;
        }
        const mmh = new Float32Array(cw * ch);
        const band = new Float32Array(cw * ch);
        for (let i = 0; i < cw * ch; i++) {
          const o = i * 4;
          const a = data[o + 3];
          if (a < 8) {
            mmh[i] = 0;
            band[i] = 0;
            continue;
          }
          const r = data[o];
          const g = data[o + 1];
          const b = data[o + 2];
          let bestD = Infinity;
          let bestMmh = 0;
          let bestBand = 0;
          for (let si = 0; si < SCALE.length; si++) {
            const s = SCALE[si];
            const dr = r - s.rgb[0];
            const dg = g - s.rgb[1];
            const db = b - s.rgb[2];
            const d = dr * dr + dg * dg + db * db;
            if (d < bestD) {
              bestD = d;
              bestMmh = s.mmh;
              bestBand = si + 1;
            }
          }
          mmh[i] = bestMmh;
          band[i] = bestBand;
        }
        const entry = { w: cw, h: ch, mmh, band };
        cacheRef.current.set(u, entry);
        while (cacheRef.current.size > DECODE_CACHE_MAX) {
          const firstKey = cacheRef.current.keys().next().value;
          if (firstKey === undefined) break;
          cacheRef.current.delete(firstKey);
        }
        if (u === url) sourceRef.current = entry;
        redraw();
      };
      img.src = u;
    };
    decode(url);
    if (nextUrl && nextUrl !== url) decode(nextUrl);
    return () => {
      cancelled = true;
    };
  }, [url, nextUrl]);




  // Pre-Decode aller bekannten Radar-PNGs, damit Scrubben über alle
  // Messzeitpunkte ohne Lazy-Decode-Stocker läuft. Idle-gescheduled.
  useEffect(() => {
    if (!prefetchUrls || prefetchUrls.length === 0) return;
    let cancelled = false;
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (h: number) => void;
    };
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const schedule = (cb: () => void) => {
      if (w.requestIdleCallback) {
        idleHandle = w.requestIdleCallback(cb, { timeout: 400 });
      } else {
        timeoutHandle = setTimeout(cb, 0);
      }
    };

    const decodeOne = (u: string, done: () => void) => {
      if (cancelled) return;
      if (cacheRef.current.has(u)) {
        done();
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => {
        if (cancelled) {
          done();
          return;
        }
        const cw = img.naturalWidth;
        const ch = img.naturalHeight;
        if (cw === 0 || ch === 0) {
          done();
          return;
        }
        const c = document.createElement("canvas");
        c.width = cw;
        c.height = ch;
        const cx = c.getContext("2d", { willReadFrequently: true });
        if (!cx) {
          done();
          return;
        }
        cx.drawImage(img, 0, 0);
        let data: Uint8ClampedArray;
        try {
          data = cx.getImageData(0, 0, cw, ch).data;
        } catch {
          done();
          return;
        }
        const mmh = new Float32Array(cw * ch);
        const band = new Float32Array(cw * ch);
        for (let i = 0; i < cw * ch; i++) {
          const o = i * 4;
          const a = data[o + 3];
          if (a < 8) {
            mmh[i] = 0;
            band[i] = 0;
            continue;
          }
          const r = data[o];
          const g = data[o + 1];
          const b = data[o + 2];
          let bestD = Infinity;
          let bestMmh = 0;
          let bestBand = 0;
          for (let si = 0; si < SCALE.length; si++) {
            const s = SCALE[si];
            const dr = r - s.rgb[0];
            const dg = g - s.rgb[1];
            const db = b - s.rgb[2];
            const d = dr * dr + dg * dg + db * db;
            if (d < bestD) {
              bestD = d;
              bestMmh = s.mmh;
              bestBand = si + 1;
            }
          }
          mmh[i] = bestMmh;
          band[i] = bestBand;
        }
        cacheRef.current.set(u, { w: cw, h: ch, mmh, band });
        while (cacheRef.current.size > DECODE_CACHE_MAX) {
          const firstKey = cacheRef.current.keys().next().value;
          if (firstKey === undefined) break;
          cacheRef.current.delete(firstKey);
        }
        done();
      };
      img.onerror = () => done();
      img.src = u;
    };

    let i = 0;
    const step = () => {
      if (cancelled) return;
      if (i >= prefetchUrls.length) return;
      const u = prefetchUrls[i++];
      decodeOne(u, () => {
        if (!cancelled) schedule(step);
      });
    };
    schedule(step);

    return () => {
      cancelled = true;
      if (idleHandle !== null && w.cancelIdleCallback) w.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    };
  }, [prefetchUrls]);

  // Frame-Cache pro (URL, view-key) — spart Neuberechnung beim Scrub/Play.
  const frameCanvasCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const viewKeyRef = useRef<string>("");
  const FRAME_CACHE_MAX = 64;

  redrawRef.current = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const srcA = cacheRef.current.get(url) ?? sourceRef.current ?? null;
    const srcBRaw = nextUrl && nextUrl !== url ? cacheRef.current.get(nextUrl) ?? null : null;
    if (!srcA && !srcBRaw) return;

    // Weicher Übergang: rein gewichtete Mischung der Intensitätsfelder in
    // EINER Zeichenfläche. Dadurch bleibt die Farbdichte konstant (kein
    // Aufhellen/Abdunkeln durch gestapelte Halbtransparenzen) und die
    // Geometrie der Flächen wird nicht verformt.
    const QSTEPS = 24;
    let wRaw = Math.max(0, Math.min(1, typeof blend === "number" ? blend : 0));
    if (!srcBRaw) wRaw = 0;
    if (!srcA) wRaw = 1;
    const w = Math.round(wRaw * QSTEPS) / QSTEPS;
    const fieldA = w >= 1 ? null : srcA;
    const fieldB = w <= 0 ? null : srcBRaw;
    if (!fieldA && !fieldB) return;

    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== size.x * dpr || cv.height !== size.y * dpr) {
      cv.width = size.x * dpr;
      cv.height = size.y * dpr;
      cv.style.width = size.x + "px";
      cv.style.height = size.y + "px";
    }
    const tl = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(cv, tl);
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const { minLat, maxLat, minLon, maxLon } = bounds;
    const center = map.getCenter();
    const viewKey = `${map.getZoom()}|${size.x}x${size.y}|${dpr}|${center.lat.toFixed(4)}|${center.lng.toFixed(4)}`;
    if (viewKey !== viewKeyRef.current) {
      frameCanvasCacheRef.current.clear();
      viewKeyRef.current = viewKey;
    }
    const cacheKey = `${fieldA ? url : ""}>${fieldB ? nextUrl : ""}@${
      fieldA && fieldB ? w : 0
    }|${viewKey}`;
    let off = frameCanvasCacheRef.current.get(cacheKey) ?? null;

    if (!off) {
      // STEP=2 halbiert den Pixel-Loop bei praktisch unveränderter Optik.
      const STEP = 2;
      const lowW = Math.max(1, Math.ceil(size.x / STEP));
      const lowH = Math.max(1, Math.ceil(size.y / STEP));
      off = document.createElement("canvas");
      off.width = lowW;
      off.height = lowH;
      const offCtx = off.getContext("2d");
      if (!offCtx) return;
      const img = offCtx.createImageData(lowW, lowH);
      const dArr = img.data;
      const latSpan = maxLat - minLat;
      const lonSpan = maxLon - minLon;

      const smoothA = fieldA ? ensureSmooth(fieldA) : null;
      const smoothB = fieldB ? ensureSmooth(fieldB) : null;
      const sampleField = (
        field: DecodedRadar,
        arr: Float32Array,
        fx: number,
        fy: number,
      ) => {
        const sw = field.w;
        const sh = field.h;
        const x0 = Math.max(0, Math.min(sw - 1, Math.floor(fx)));
        const y0 = Math.max(0, Math.min(sh - 1, Math.floor(fy)));
        const x1 = Math.min(sw - 1, x0 + 1);
        const y1 = Math.min(sh - 1, y0 + 1);
        const tx = Math.max(0, Math.min(1, fx - x0));
        const ty = Math.max(0, Math.min(1, fy - y0));
        const v00 = arr[y0 * sw + x0];
        const v01 = arr[y0 * sw + x1];
        const v10 = arr[y1 * sw + x0];
        const v11 = arr[y1 * sw + x1];
        return (
          v00 * (1 - tx) * (1 - ty) +
          v01 * tx * (1 - ty) +
          v10 * (1 - tx) * ty +
          v11 * tx * ty
        );
      };

      const wA = fieldA && fieldB ? 1 - w : fieldA ? 1 : 0;
      const wB = fieldA && fieldB ? w : fieldB ? 1 : 0;

      for (let ly = 0; ly < lowH; ly++) {
        for (let lx = 0; lx < lowW; lx++) {
          const ll = map.containerPointToLatLng([lx * STEP, ly * STEP]);
          if (ll.lat < minLat || ll.lat > maxLat || ll.lng < minLon || ll.lng > maxLon) continue;
          let v = 0;
          if (fieldA && smoothA) {
            const fx = ((ll.lng - minLon) / lonSpan) * (fieldA.w - 1);
            const fy = ((maxLat - ll.lat) / latSpan) * (fieldA.h - 1);
            if (fx >= 0 && fx <= fieldA.w - 1 && fy >= 0 && fy <= fieldA.h - 1) {
              v += wA * sampleField(fieldA, smoothA, fx, fy);
            }
          }
          if (fieldB && smoothB) {
            const fx = ((ll.lng - minLon) / lonSpan) * (fieldB.w - 1);
            const fy = ((maxLat - ll.lat) / latSpan) * (fieldB.h - 1);
            if (fx >= 0 && fx <= fieldB.w - 1 && fy >= 0 && fy <= fieldB.h - 1) {
              v += wB * sampleField(fieldB, smoothB, fx, fy);
            }
          }
          // `v` ist ein kontinuierlicher Bandindex (0 = trocken). Einfärbung
          // über die gerundete Stufe — dadurch entstehen keine einzelnen
          // Pixel der Nachbarfarbe innerhalb einer Fläche.
          if (v < 0.5) continue;
          const bandIdx = Math.min(SCALE.length, Math.max(1, Math.round(v))) - 1;
          const s = SCALE[bandIdx];
          const [r, g, b] = s.rgb;
          const alpha = Math.round(s.a * 255);
          if (alpha === 0) continue;
          const idx = (ly * lowW + lx) * 4;
          dArr[idx] = r;
          dArr[idx + 1] = g;
          dArr[idx + 2] = b;
          dArr[idx + 3] = alpha;
        }
      }
      offCtx.putImageData(img, 0, 0);
      frameCanvasCacheRef.current.set(cacheKey, off);
      while (frameCanvasCacheRef.current.size > FRAME_CACHE_MAX) {
        const firstKey = frameCanvasCacheRef.current.keys().next().value;
        if (firstKey === undefined) break;
        frameCanvasCacheRef.current.delete(firstKey);
      }
    } else {
      // LRU-Touch.
      frameCanvasCacheRef.current.delete(cacheKey);
      frameCanvasCacheRef.current.set(cacheKey, off);
    }

    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, 0, 0, off.width, off.height, 0, 0, size.x, size.y);
    ctx.restore();
    cv.style.opacity = String(Math.max(0, Math.min(1, opacity)));
  };

  useEffect(() => {
    redraw();
  }, [payload, blend, nextUrl, bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon]);

  // Opazität separat nachziehen — ohne Neuberechnung des Frame-Canvas.
  useEffect(() => {
    const cv = canvasRef.current;
    if (cv) cv.style.opacity = String(Math.max(0, Math.min(1, opacity)));
  }, [opacity]);

  return null;
}

/**
 * Weicher Übergang zwischen zwei Niederschlagsfeldern in EINER Zeichenfläche.
 * Es werden nicht zwei halbtransparente Ebenen gestapelt (das erzeugt beim
 * Überlappen ein Aufhellen/Abdunkeln und wirkt als Flackern), sondern die
 * Intensitätsfelder werden gewichtet gemischt und danach eingefärbt. Dadurch
 * bleibt die Farbdichte über den gesamten Übergang konstant. Die Geometrie der
 * Flächen wird nie verformt oder verschoben.
 */
function CrossfadePrecipOverlay({
  url,
  nextUrl,
  blend = 0,
  bounds,
  opacity,
  prefetchUrls,
}: {
  url: string;
  nextUrl?: string | null;
  blend?: number;
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  opacity: number;
  prefetchUrls?: string[];
}) {
  return (
    <MeasurementCanvasOverlay
      url={url}
      nextUrl={nextUrl}
      blend={blend}
      bounds={bounds}
      opacity={opacity}
      prefetchUrls={prefetchUrls}
    />
  );
}


/**
 * Hagel-Punkt-Overlay für MESS-Frames: leitet aus der Niederschlagsintensität
 * (ICON-CH1 past_minutely_15, im Frame als `values` enthalten) eine
 * Hagel-Wahrscheinlichkeit ab und zeichnet schwarze Punkte im POH-Stil dort,
 * wo Intensität ein gewittertypisches Niveau erreicht. Nur aktiv für
 * frame.source === "radar". Forecast-Frames bleiben unberührt.
 */
function MeasurementHailDotsLayer({
  payload,
  frame,
}: {
  payload: RadarPayload;
  frame: RadarFrame | null;
}) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    const CanvasLayer = L.Layer.extend({
      onAdd(this: L.Layer & { _canvas?: HTMLCanvasElement }) {
        const pane = map.getPanes().overlayPane;
        const cv = L.DomUtil.create("canvas", "radar-hail-canvas") as HTMLCanvasElement;
        cv.style.position = "absolute";
        cv.style.pointerEvents = "none";
        cv.style.willChange = "transform";
        cv.style.zIndex = "470";
        pane.appendChild(cv);
        this._canvas = cv;
        canvasRef.current = cv;
        map.on("moveend resize", redraw);
        attachCanvasZoomAnim(map, cv, redraw);
        redraw();
        return this;
      },
      onRemove(this: L.Layer & { _canvas?: HTMLCanvasElement }) {
        if (this._canvas) this._canvas.remove();
        map.off("moveend resize", redraw);
        detachCanvasZoomAnim(this._canvas);
        canvasRef.current = null;
        return this;
      },
    });
    const layer = new (CanvasLayer as unknown as new () => L.Layer)();
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const redrawRef = useRef<() => void>(() => {});
  function redraw() {
    redrawRef.current();
  }

  redrawRef.current = () => {
    const cv = canvasRef.current;
    if (!cv || !frame) return;
    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;
    cv.width = size.x * dpr;
    cv.height = size.y * dpr;
    cv.style.width = size.x + "px";
    cv.style.height = size.y + "px";
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(cv, topLeft);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);

    // Nur für Mess-Frames (Radar) — Prognose ist explizit ausgeschlossen.
    if (frame.source !== "radar") return;
    const vals = frame.values;
    if (!vals || vals.length === 0) return;

    const { gridLat, gridLon } = payload;
    const nLat = gridLat.length;
    const nLon = gridLon.length;

    const sampleAt = (arr: number[], fx: number, fy: number) => {
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const txL = fx - x0;
      const tyL = fy - y0;
      const inX0 = x0 >= 0 && x0 < nLon;
      const inX1 = x1 >= 0 && x1 < nLon;
      const inY0 = y0 >= 0 && y0 < nLat;
      const inY1 = y1 >= 0 && y1 < nLat;
      if ((!inX0 && !inX1) || (!inY0 && !inY1)) return 0;
      const v00 = inX0 && inY0 ? arr[y0 * nLon + x0] : 0;
      const v01 = inX1 && inY0 ? arr[y0 * nLon + x1] : 0;
      const v10 = inX0 && inY1 ? arr[y1 * nLon + x0] : 0;
      const v11 = inX1 && inY1 ? arr[y1 * nLon + x1] : 0;
      return (
        v00 * (1 - txL) * (1 - tyL) +
        v01 * txL * (1 - tyL) +
        v10 * (1 - txL) * tyL +
        v11 * txL * tyL
      );
    };

    // Stabiler Seed pro Frame (kein Flackern beim Step).
    const seed = (Date.parse(frame.t) / 60000) | 0;
    const hash = (ix: number, iy: number) => {
      let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
      h = (h ^ (h >>> 13)) * 1274126177;
      h = h ^ (h >>> 16);
      return ((h >>> 0) % 10000) / 10000;
    };

    // Hagel ab ca. 25 mm/h wahrscheinlich (Starkregen → konvektive Zelle),
    // praktisch sicher ab 50 mm/h.
    const HAIL_LOW = 25;
    const HAIL_HIGH = 50;
    const smoothstep = (a: number, b: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "rgba(0,0,0,0.85)";

    // Raster ~6 CSS-Pixel.
    const STEP = 6;
    for (let py = 0; py < size.y; py += STEP) {
      for (let px = 0; px < size.x; px += STEP) {
        const ll = map.containerPointToLatLng([px, py]);
        const fx = ((ll.lng - gridLon[0]) / (gridLon[nLon - 1] - gridLon[0])) * (nLon - 1);
        const fy = ((ll.lat - gridLat[0]) / (gridLat[nLat - 1] - gridLat[0])) * (nLat - 1);
        if (fx < 0 || fx > nLon - 1 || fy < 0 || fy > nLat - 1) continue;
        const v = sampleAt(vals, fx, fy);
        if (v < HAIL_LOW) continue;
        const prob = smoothstep(HAIL_LOW, HAIL_HIGH, v);
        // Deterministisches Stippling → Dichte ~ prob.
        const ix = Math.round(px / STEP);
        const iy = Math.round(py / STEP);
        if (hash(ix, iy) > prob * 0.55) continue;
        ctx.beginPath();
        ctx.arc(px, py, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  useEffect(() => {
    redrawRef.current();
  }, [frame, payload]);

  return null;
}

/**
 * Blitz-Layer für das Niederschlagsradar.
 *
 * Anders als im Satellitenbild altern Blitze hier nicht über mehrere Frames:
 * Sie glühen im Zeitschritt, in den ihr Zeitstempel fällt, kurz auf und sind
 * beim nächsten Schritt wieder verschwunden.
 */
const FLASH_FRACTION = 0.4; // Aufglühen klingt über die ersten 40 % des Schritts ab

/** Zickzack-Blitz (viewBox 0 0 24 24) — geteilt von Karte und Legende. */
const BOLT_PATH = "M13.5 2 5 14h5.5L9.5 22 19 9.5h-5.8L13.5 2Z";

function boltSvg(size: number, opacity: number, mirrored: boolean, tilt: number): string {
  const glow = (opacity * 0.85).toFixed(2);
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="overflow:visible;transform:rotate(${tilt}deg)${mirrored ? " scaleX(-1)" : ""};opacity:${opacity.toFixed(2)};filter:drop-shadow(0 0 ${(size * 0.35).toFixed(1)}px rgba(253,224,71,${glow})) drop-shadow(0 0 ${(size * 0.7).toFixed(1)}px rgba(253,224,71,${(opacity * 0.5).toFixed(2)}))">`
    + `<path d="${BOLT_PATH}" fill="#fde047" stroke="#fde047" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.55"/>`
    + `<path d="${BOLT_PATH}" fill="#fffbe0" stroke="#ffffff" stroke-width="0.9" stroke-linejoin="round"/>`
    + `</svg>`;
}


function RadarLightningLayer({
  strikes,
  stepStartMs,
  stepEndMs,
  progress,
}: {
  strikes: LightningStrike[];
  stepStartMs: number;
  stepEndMs: number;
  progress: number;
}) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const pane = map.getPane("radar-lightning") ?? map.createPane("radar-lightning");
    pane.style.zIndex = "655";
    pane.style.pointerEvents = "none";
    const group = L.layerGroup([], { pane: "radar-lightning" });
    group.addTo(map);
    layerRef.current = group;
    return () => {
      group.remove();
      layerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const group = layerRef.current;
    if (!group) return;
    group.clearLayers();

    const p = Math.max(0, Math.min(1, progress));
    if (p >= FLASH_FRACTION) return;
    // 1 → 0 über die erste Phase des Zeitschritts.
    const k = 1 - p / FLASH_FRACTION;
    const opacity = Math.max(0.05, k);
    const radius = 3 + 4 * k;

    for (const s of strikes) {
      const t = Date.parse(s.t);
      if (!Number.isFinite(t)) continue;
      if (t < stepStartMs || t >= stepEndMs) continue;

      // Halo
      L.circleMarker([s.lat, s.lon], {
        pane: "radar-lightning",
        radius: radius + 6 * k,
        stroke: false,
        fill: true,
        fillColor: "#fde047",
        fillOpacity: opacity * 0.3,
        interactive: false,
      }).addTo(group);
      // Kern
      L.circleMarker([s.lat, s.lon], {
        pane: "radar-lightning",
        radius,
        stroke: true,
        color: "#ffffff",
        weight: 1,
        fill: true,
        fillColor: "#fffbe0",
        fillOpacity: opacity,
        interactive: false,
      }).addTo(group);
    }
  }, [strikes, stepStartMs, stepEndMs, progress]);

  return null;
}


function useNowFrameIndex(frames: RadarFrame[]): number {
  return useMemo(() => {
    if (frames.length === 0) return 0;
    const now = Date.now();
    // 1. Letzter echter Radar-Messframe mit t <= now (keine Toleranz —
    //    sonst springt die Anzeige in den Forecast hinein).
    let latestRadarIdx = -1;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (f.source !== "radar") continue;
      if (Date.parse(f.t) <= now) latestRadarIdx = i;
    }
    if (latestRadarIdx >= 0) return latestRadarIdx;
    // 2. Fallback: letzter Radar-Frame überhaupt
    for (let i = frames.length - 1; i >= 0; i--) {
      if (frames[i].source === "radar") return i;
    }
    // 3. Fallback: closest-to-now
    let bestIdx = 0;
    let bestDt = Infinity;
    for (let i = 0; i < frames.length; i++) {
      const dt = Math.abs(Date.parse(frames[i].t) - now);
      if (dt < bestDt) {
        bestDt = dt;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [frames]);
}


function timelineColorForMs(ms: number): string {
  return ms <= Date.now() ? MEASUREMENT_COLOR : FORECAST_COLOR;
}


// ---------------- MeteoSchweiz-Style Timeline ----------------

const WEEKDAY_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function fmtUpdatedAt(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}





function fmtBubble(d: Date, measured: boolean): string {
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const kind = measured ? "Messung" : "Prognose";
  return `${kind}: ${wd}, ${hh}:${mm}`;
}


// FilmstripTimeline lebt jetzt in ./filmstrip-timeline und wird von allen
// Karten (Radar, Satellit, Wind) geteilt.








export function RadarMap({
  bare = false,
  initialFrames,
}: {
  bare?: boolean;
  initialFrames?: RadarPayload;
}) {
  const { data, isLoading, error } = useQuery({
    ...radarFramesQuery(),
    initialData: initialFrames,
    initialDataUpdatedAt: initialFrames ? Date.now() : undefined,
  });

  // Modellprognose bis +48 h: CH1 primär, CH2 nahtloser Fallback.
  // Client-Cap auf +48 h für ältere Cache-Antworten.
  const frames = useMemo(() => {
    const all = data?.frames ?? [];
    const cutoff = Date.now() + 48 * 3600 * 1000;
    return all.filter((f) => Date.parse(f.t) <= cutoff);
  }, [data]);
  const nowIdx = useNowFrameIndex(frames);
  const [idx, setIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2); // Default 2× beim Play
  const [showHail, setShowHail] = useState(true);
  const [legendOpen, setLegendOpen] = useState(false);
  const [showLightning, setShowLightning] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("radar.lightning") === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("radar.lightning", showLightning ? "1" : "0");
  }, [showLightning]);
  const { data: lightningData } = useQuery({
    queryKey: ["lightning"],
    queryFn: () => getLightningStrikes(),
    enabled: showLightning,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const lightningStrikes = useMemo(() => lightningData?.strikes ?? [], [lightningData]);
  // Persistente, kontinuierliche Render-Zeit. `idx` ist nur noch der nächste
  // UI-Anker für Buttons/Labels; diese Zeit steuert den sichtbaren Zustand.
  const [renderMs, setRenderMs] = useState<number | null>(null);
  // Eine einzige kontinuierliche Render-Zeit für Play/Scrub. Der konkrete
  // Anzeigezustand wird zentral aus dieser Zeit abgeleitet.
  const [playVisualMs, setPlayVisualMs] = useState<number | null>(null);
  // Kontinuierliche Scrub-Zeit während aktivem Drag (überschreibt cadence-
  // gesnapptes idx für kontinuierliches Rendering; kein Re-Render der ganzen
  // Map nötig).
  const [scrubVisualMs, setScrubVisualMs] = useState<number | null>(null);
  const isMobile = useIsMobile();



  // Auf "jetzt" springen sobald Daten da sind.
  useEffect(() => {
    if (idx === null && frames.length > 0) {
      setIdx(nowIdx);
      setRenderMs(Date.parse(frames[nowIdx]?.t ?? frames[0].t));
    }
  }, [nowIdx, frames, idx]);

  useEffect(() => {
    if (renderMs === null || frames.length === 0) return;
    const firstMs = Date.parse(frames[0].t);
    const lastMs = Date.parse(frames[frames.length - 1].t);
    if (renderMs < firstMs) setRenderMs(firstMs);
    else if (renderMs > lastMs) setRenderMs(lastMs);
  }, [frames, renderMs]);

  // Gemischtes Zeitraster: Messung im 5-min-Takt (auf echte Radarframes
  // gesnappt), Prognose exakt auf den vorhandenen Prognose-Frames (deren
  // Kadenz wird aus den Daten abgeleitet — heute 15 min, künftig ggf. 60 min).
  const timelineSteps = useMemo(() => {
    if (frames.length === 0) return [] as number[];
    const times = frames.map((f) => Date.parse(f.t));
    const firstMs = times[0];
    const lastMs = times[times.length - 1];
    const nowMs = Date.now();
    const STEP5 = 5 * 60_000;
    const TOL = STEP5 / 2;

    // Nächsten Frame zu targetMs per binärer Suche; null wenn ausserhalb Toleranz.
    const pickNearest = (targetMs: number, tolMs: number): number | null => {
      let lo = 0;
      let hi = times.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (times[mid] < targetMs) lo = mid + 1;
        else hi = mid;
      }
      const candidates = [lo];
      if (lo > 0) candidates.push(lo - 1);
      let best = -1;
      let bestDiff = Infinity;
      for (const i of candidates) {
        const d = Math.abs(times[i] - targetMs);
        if (d < bestDiff) {
          bestDiff = d;
          best = i;
        }
      }
      return bestDiff <= tolMs ? best : null;
    };

    const out: number[] = [];
    const push = (ms: number) => {
      if (ms < firstMs || ms > lastMs) return;
      if (out.length > 0 && out[out.length - 1] >= ms) return;
      out.push(ms);
    };

    // Messteil: 5-min-Raster, nur Zeitpunkte mit echtem Frame.
    const startMs = Math.ceil(firstMs / STEP5) * STEP5;
    for (let t = startMs; t <= Math.min(lastMs, nowMs); t += STEP5) {
      const i = pickNearest(t, TOL);
      if (i !== null) push(times[i]);
    }

    // Prognoseteil: Stundenraster. ICON-CH1 liefert keine echten 15-min-Felder
    // (die 15-min-Reihe wiederholt den Stundenwert), darum ein Schritt pro
    // Stunde — nur wenn dazu ein echtes Feld existiert.
    const HOUR = 60 * 60_000;
    const HOUR_TOL = 4 * 60_000;
    const startFc = Math.ceil((nowMs + 1) / HOUR) * HOUR;
    for (let t = startFc; t <= lastMs; t += HOUR) {
      const i = pickNearest(t, HOUR_TOL);
      if (i !== null && times[i] > nowMs) push(times[i]);
    }








    if (out.length === 0) out.push(firstMs);
    return out;
  }, [frames]);



  const idxRef = useRef<number | null>(null);
  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);
  const renderMsRef = useRef<number | null>(null);
  useEffect(() => {
    renderMsRef.current = renderMs;
  }, [renderMs]);

  // Cursor im 5-min-Raster für eine gegebene Zeit (nächstgelegener Schritt).
  const cursorForMs = (ms: number | null): number => {
    if (timelineSteps.length === 0 || ms === null) return 0;
    let best = 0;
    let bestDt = Infinity;
    for (let i = 0; i < timelineSteps.length; i++) {
      const dt = Math.abs(timelineSteps[i] - ms);
      if (dt < bestDt) {
        bestDt = dt;
        best = i;
      }
    }
    return best;
  };

  const setTimelineToMs = (targetMs: number | null | undefined) => {
    if (typeof targetMs !== "number" || Number.isNaN(targetMs)) return;
    setIdx(nearestFrameIndexForMs(frames, targetMs));
    setRenderMs(targetMs);
    setPlayVisualMs(null);
    setScrubVisualMs(null);
  };


  // Play-Loop: kontinuierliche Zeitachse. Kein Quellen-Sonderfall am Seam;
  // Play und Scrub werden später über denselben Timeline-Sampler gerendert.
  const playTimeRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playing || timelineSteps.length === 0 || frames.length === 0) {
      playTimeRef.current = null;
      setPlayVisualMs(null);
      return;
    }

    const FRAME_MS = 1800 / speed;
    // Jeder Timeline-Schritt dauert gleich lang, egal ob 5-min-Messung oder
    // gröberer Prognoseschritt. Die lokale Schrittweite wird zur Laufzeit aus
    // dem Raster gelesen, damit die Prognose nicht durchrast.
    const gapAtMs = (ms: number): number => {
      if (timelineSteps.length < 2) return 5 * 60_000;
      let i = 0;
      while (i < timelineSteps.length - 2 && timelineSteps[i + 1] <= ms) i++;
      return Math.max(60_000, timelineSteps[i + 1] - timelineSteps[i]);
    };

    let raf = 0;
    let last = performance.now();
    const firstMs = timelineSteps[0];
    const lastMs = timelineSteps[timelineSteps.length - 1];
    const idxMs =
      timelineSteps[cursorForMs(renderMsRef.current)] ??
      Date.parse(frames[idxRef.current ?? 0]?.t ?? frames[0].t);
    const rawStart = scrubVisualMs ?? renderMsRef.current ?? idxMs;
    const clamped = Math.max(firstMs, Math.min(lastMs, rawStart));
    // Steht der Cursor praktisch am Ende (z. B. nach einem Durchlauf), von
    // vorne starten, sonst würde Play sofort wieder stoppen.
    const startMs = lastMs - clamped <= gapAtMs(clamped) * 0.5 ? firstMs : clamped;

    playTimeRef.current = startMs;
    // Playback hat Vorrang: eine hängengebliebene Scrub-Zeit würde die Anzeige
    // sonst dauerhaft einfrieren.
    setScrubVisualMs(null);
    setPlayVisualMs(startMs);
    setRenderMs(startMs);

    let lastFlush = performance.now();
    const FLUSH_MS = 60;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const prevMs = playTimeRef.current ?? startMs;
      let nextMs = prevMs + (dt * gapAtMs(prevMs)) / FRAME_MS;
      if (nextMs >= lastMs) {
        // Endlosschleife: am Ende wieder von vorne beginnen.
        nextMs = firstMs;
        playTimeRef.current = nextMs;
        renderMsRef.current = nextMs;
        lastFlush = now;
        setPlayVisualMs(nextMs);
        setRenderMs(nextMs);
        const wrapIdx = nearestFrameIndexForMs(frames, nextMs);
        idxRef.current = wrapIdx;
        setIdx(wrapIdx);
        raf = requestAnimationFrame(tick);
        return;
      }

      playTimeRef.current = nextMs;
      renderMsRef.current = nextMs;
      // React-State nur gedrosselt anfassen: Overlays lesen aus Props, die
      // sich pro Tick sonst ändern und teure Redraws auslösen würden. Im
      // Prognoseteil verändert sich das Bild nun kontinuierlich, daher ein
      // etwas dichterer Flush (~16 Hz) für Bubble/Label/Idx.
      if (now - lastFlush >= FLUSH_MS) {
        lastFlush = now;
        setPlayVisualMs(nextMs);
        setRenderMs(nextMs);
        const nextIdx = nearestFrameIndexForMs(frames, nextMs);
        if (nextIdx !== idxRef.current) {
          idxRef.current = nextIdx;
          setIdx(nextIdx);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      playTimeRef.current = null;
      setPlayVisualMs(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, timelineSteps, frames]);

  const currentFrame = idx !== null ? frames[idx] ?? null : null;
  // Der sichtbare Zustand wird unten über `timelineStateForMs` kontinuierlich
  // zwischen den benachbarten Frames gerendert.


  // Alle Radar-PNG-URLs (Messung + Prognose) für Pre-Decode (Scrub ohne Stocker).
  const radarUrls = useMemo(
    () => frames.filter((f) => !!f.precipUrl).map((f) => f.precipUrl as string),
    [frames],
  );

  const stripMs = scrubVisualMs ?? playVisualMs ?? renderMs;
  const stripIdx = cursorForMs(stripMs);
  const stripNowIdx = useMemo(
    () => cursorForMs(Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timelineSteps],
  );

  // Zeitfenster des aktuell gezeigten Schritts (für das Blitz-Aufglühen).
  // Nur im Messteil — für die Prognose gibt es keine Blitzdaten.
  const lightningWindow = (() => {
    if (!showLightning || timelineSteps.length === 0) return null;
    const ms = stripMs ?? timelineSteps[0];
    let i = 0;
    while (i < timelineSteps.length - 1 && timelineSteps[i + 1] <= ms) i++;
    const start = timelineSteps[i];
    const end = timelineSteps[i + 1] ?? start + 5 * 60_000;
    if (start > Date.now()) return null;
    const span = Math.max(60_000, end - start);
    const progress = Math.max(0, Math.min(1, (ms - start) / span));
    return { start, end, progress };
  })();



  // (Backdrop-Layer entfernt — stabile ImageOverlay-Instanz unten aktualisiert
  // ihre URL via Leaflet `setUrl()` ohne Mount/Unmount, kein Leerframe.)


  // Alle Radar-PNGs vorab in den Browser-Cache laden → kein Aufflackern beim
  // Framewechsel, sofortiger Snap beim Scrubben.
  useEffect(() => {
    if (!data) return;
    const imgs: HTMLImageElement[] = [];
    for (const f of data.frames) {
      if (f.precipUrl) {
        const i = new Image();
        i.decoding = "async";
        i.src = f.precipUrl;
        imgs.push(i);
      }
      if (f.hailUrl) {
        const i = new Image();
        i.decoding = "async";
        i.src = f.hailUrl;
        imgs.push(i);
      }
    }
    return () => {
      for (const i of imgs) i.src = "";
    };
  }, [data]);

  

  // Frame "trocken"? Canvas-Frames: max(values) prüfen. PNG-Frames: unbekannt
  // (true=trocken nur bei genau 0 values und keiner URL — wird hier vorsichtig
  // als unbekannt behandelt, damit echte Radar-PNGs nie fälschlich als trocken
  // gemeldet werden).
  const frameMaxMmh = (f: RadarFrame | null): number | null => {
    if (!f) return null;
    if (f.precipUrl) return null; // unbekannt
    if (!f.values || f.values.length === 0) return 0;
    let m = 0;
    for (let i = 0; i < f.values.length; i++) if (f.values[i] > m) m = f.values[i];
    return m;
  };
  void frameMaxMmh;

  return (
    <div className={cn("@container", bare ? "relative flex h-full w-full flex-col" : "space-y-3")}>
      <div
        className={cn(
          "relative overflow-hidden shadow-lg",
          bare
            ? "h-full w-full min-h-0 flex-1"
            : "-mx-3 h-[560px] w-auto sm:mx-0 sm:h-[600px] sm:w-full sm:rounded-2xl",
        )}
      >
        <MapContainer
          center={[47.575, 9.35]}
          zoom={9.5}
          zoomSnap={0.5}
          zoomDelta={0.5}
          maxBounds={maxBoundsExt}
          maxBoundsViscosity={1.0}
          minZoom={9}
          maxZoom={15}
          scrollWheelZoom
          zoomControl={false}
          attributionControl={true}
          style={{ height: "100%", width: "100%", background: "#ebefeb" }}
        >
          <InvalidateOnResize />
          
          <TileLayer
            url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte_reliefschattierung/default/current/3857/{z}/{x}/{y}.png"
            maxZoom={18}
            opacity={0.55}
            attribution='Quelle: Oberthurgauer Wetter · © <a href="https://www.swisstopo.admin.ch/">swisstopo</a> · MeteoSchweiz'
          />
          <GeoJSON
            data={OUTSIDE_CH_MASK}
            style={() => ({ stroke: false, fillColor: "#3a4148", fillOpacity: 0.4 })}
            interactive={false}
          />
          <GeoJSON
            data={OUTSIDE_MASK}
            style={() => ({ stroke: false, fillColor: "#5a6670", fillOpacity: 0.18 })}
            interactive={false}
          />
          <GeoJSON
            data={LAKE}
            style={() => ({ color: "#5ba8c8", weight: 1.2, fillColor: "#7ec8e3", fillOpacity: 0.25 })}
            interactive={false}
          />

          <GeoJSON
            data={SWITZERLAND}
            style={() => ({ color: "#ffffff", weight: 1.2, opacity: 0.95, fill: false })}
            interactive={false}
          />
          <GeoJSON
            data={THURGAU}
            style={() => ({ color: "#1f4d80", weight: 1, opacity: 0.45, fill: false })}
            interactive={false}
          />
          <GeoJSON
            data={REGION_OUTLINE}
            style={() => ({ color: "#1f4d80", weight: 2, opacity: 0.9, fill: false })}
            interactive={false}
          />
          {data &&
            currentFrame &&
            (() => {
              const rtMs = scrubVisualMs ?? playVisualMs ?? renderMs ?? Date.parse(currentFrame.t);
              const timelineState = timelineStateForMs(frames, rtMs);
              let overlayFrame = timelineState.frame ?? currentFrame;
              let overlayNext = timelineState.nextFrame;
              let overlayProg = timelineState.progress;

              // Prognose: Übergang aus dem angezeigten Zeitraster (Stundenschritt)
              // ableiten statt aus dem Feldabstand der Rohdaten — sonst blendet
              // der vordere Bereich (15-min-Frames) gar nicht über.
              if (rtMs > Date.now() && timelineSteps.length > 1) {
                let bi = -1;
                for (let k = 0; k < timelineSteps.length - 1; k++) {
                  if (rtMs >= timelineSteps[k] && rtMs <= timelineSteps[k + 1]) {
                    bi = k;
                    break;
                  }
                }
                if (bi >= 0) {
                  const aMs = timelineSteps[bi];
                  const bMs = timelineSteps[bi + 1];
                  const a = frames[nearestFrameIndexForMs(frames, aMs)];
                  const b = frames[nearestFrameIndexForMs(frames, bMs)];
                  if (a && b) {
                    overlayFrame = a;
                    overlayNext = b;
                    overlayProg = Math.max(0, Math.min(1, (rtMs - aMs) / Math.max(1, bMs - aMs)));
                  }
                } else {
                  const lastStep = timelineSteps[timelineSteps.length - 1];
                  if (rtMs >= lastStep) {
                    const a = frames[nearestFrameIndexForMs(frames, lastStep)];
                    if (a) {
                      overlayFrame = a;
                      overlayNext = null;
                      overlayProg = 0;
                    }
                  }
                }
              }


              const hasPng = !!overlayFrame?.precipUrl;
              const hasGrid = Array.isArray(overlayFrame?.values) && overlayFrame.values.length > 0;
              const nextHasGrid = Array.isArray(overlayNext?.values) && overlayNext.values.length > 0;
              const ib = overlayFrame?.imageBbox ?? data.imageBbox;
              const opacityVal = 0.6;

              const showPng = !!overlayFrame && hasPng;
              const showGrid = !!overlayFrame && hasGrid && !hasPng;
              const warmGrid = !!overlayFrame && hasPng && !!overlayNext && nextHasGrid;
              const gridFrame = showGrid ? overlayFrame : warmGrid ? overlayNext : null;

              // Prognosefelder halten den Grossteil des Schritts stabil und
              // gehen nur im letzten Abschnitt weich ins nächste Feld über.
              // Messframes bleiben wie bisher harte Frame-Wechsel.
              const isForecast = overlayFrame.source !== "radar";
              const fadeW = isForecast ? fadeWeight(overlayProg) : 0;

              return (
                <>
                  {gridFrame && (
                    <PrecipOverlay
                      payload={data}
                      frame={gridFrame}
                      nextFrame={showGrid ? overlayNext : null}
                      progress={showGrid ? fadeW : 0}
                      opacity={showGrid ? opacityVal : 0}
                      prewarmFrames={frames}
                    />
                  )}
                  {showPng && (
                    <CrossfadePrecipOverlay
                      url={overlayFrame.precipUrl as string}
                      nextUrl={overlayNext?.precipUrl ?? null}
                      blend={fadeW}
                      bounds={ib}
                      opacity={opacityVal}
                      prefetchUrls={radarUrls}
                    />
                  )}


                </>
              );
            })()}
          {data && currentFrame && showHail && currentFrame.hailUrl && (
            <StableImageOverlay
              url={currentFrame.hailUrl}
              bounds={[
                [data.imageBbox.minLat, data.imageBbox.minLon],
                [data.imageBbox.maxLat, data.imageBbox.maxLon],
              ]}
              opacity={0.8}
              className="hail-blackdots"
            />
          )}
          {data && currentFrame && showHail && currentFrame.source === "radar" && (
            <MeasurementHailDotsLayer payload={data} frame={currentFrame} />
          )}
          {showLightning && lightningWindow && (
            <RadarLightningLayer
              strikes={lightningStrikes}
              stepStartMs={lightningWindow.start}
              stepEndMs={lightningWindow.end}
              progress={lightningWindow.progress}
            />
          )}




          <CityMarkers />
          <ZoomControl position="topright" />

        </MapContainer>






        {/* Legende oben rechts (unter Zoom) — nur auf Klick */}
        {legendOpen ? (
          <div className="absolute right-3 top-24 z-[400] flex flex-col gap-0.5 rounded-md bg-card/95 p-1.5 text-[9px] shadow-md sm:p-2 sm:text-[10px]">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-semibold text-foreground">mm/h</span>
              <button
                type="button"
                aria-label="Legende schliessen"
                onClick={() => setLegendOpen(false)}
                className="-mr-0.5 rounded p-0.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {[...SCALE].reverse().map((s) => (
              <div key={s.mmh} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-3 rounded-sm sm:h-3 sm:w-4"
                  style={{ background: `rgb(${s.rgb.join(",")})` }}
                />
                <span className="tabular-nums text-muted-foreground">{s.mmh}</span>
              </div>
            ))}
            <span className="mt-1.5 mb-0.5 font-semibold text-foreground">Schnee</span>
            {SNOW_SCALE.map((s) => (
              <div key={`snow-${s.mmh}`} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-3 rounded-sm sm:h-3 sm:w-4"
                  style={{ background: `rgb(${s.rgb.join(",")})` }}
                />
                <span className="text-muted-foreground">{s.label}</span>
              </div>
            ))}
            <span className="mt-1.5 mb-0.5 font-semibold text-foreground">Hagel</span>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-3 rounded-sm bg-white sm:h-3 sm:w-4"
                style={{
                  backgroundImage: "radial-gradient(circle, #000 35%, transparent 36%)",
                  backgroundSize: "4px 4px",
                }}
              />
              <span className="text-muted-foreground">POH</span>
            </div>
            <span className="mt-1.5 mb-0.5 font-semibold text-foreground">Blitze</span>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-3 rounded-sm sm:h-3 sm:w-4"
                style={{
                  backgroundImage: "radial-gradient(circle, #fffbe0 30%, #fde047 55%, transparent 60%)",
                }}
              />
              <span className="text-muted-foreground">Blitzortung</span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLegendOpen(true)}
            aria-label="Legende anzeigen"
            title="Legende"
            className="absolute right-3 top-24 z-[400] flex h-8 w-8 items-center justify-center rounded-full bg-card/50 text-foreground/70 shadow-md transition hover:bg-card hover:text-foreground"
          >
            <Info className="h-4 w-4" />
          </button>
        )}

        {/* Blitze ein-/ausblenden */}
        <button
          type="button"
          onClick={() => setShowLightning((v) => !v)}
          aria-pressed={showLightning}
          aria-label={showLightning ? "Blitze ausblenden" : "Blitze einblenden"}
          title={showLightning ? "Blitze ausblenden" : "Blitze einblenden"}
          className={cn(
            "absolute right-3 top-[8.5rem] z-[400] flex h-8 w-8 items-center justify-center rounded-full shadow-md transition",
            showLightning
              ? "bg-amber-400 text-neutral-900"
              : "bg-card/50 text-foreground/70 hover:bg-card hover:text-foreground",
          )}
        >
          <Zap className="h-4 w-4" />
        </button>


      </div>

      {/* Steuerung — bare: schwebendes Overlay; sonst Panel unterhalb der Karte */}
      <div
        className={cn(
          bare
            ? "pointer-events-none absolute inset-x-2 bottom-2 z-[450] sm:inset-x-3 sm:bottom-3"
            : "w-full",
        )}
      >
        <div
          className={cn(
            "rounded-xl border border-neutral-200 p-2 text-neutral-900 sm:p-2.5",
            bare
              ? "pointer-events-auto bg-white/90 shadow-lg backdrop-blur"
              : "bg-white shadow-sm",
          )}
        >
            {isLoading && (
              <p className="text-center text-xs text-neutral-500">Lade Radardaten …</p>
            )}
            {error && (
              <p className="text-center text-xs text-red-600">
                Radardaten konnten nicht geladen werden.
              </p>
            )}
            {!isLoading && !error && data && frames.length === 0 && (
              <p className="text-center text-xs text-neutral-600">
                {data.warning ?? "Radardaten sind derzeit nicht verfügbar."}
              </p>
            )}
            {!isLoading && !error && data && frames.length > 0 && data.hasRealRadar &&
              !frames.some((f) => Date.parse(f.t) > Date.now()) && (
                <p className="text-center text-xs text-amber-700">
                  Prognose-Layer wird gerade neu berechnet – bislang nur Messdaten sichtbar.
                </p>
              )}


            {data && frames.length > 0 && idx !== null && (
              <>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Play/Pause */}
                  <button
                    type="button"
                    onClick={() => setPlaying((p) => !p)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 sm:h-7 sm:w-7"
                    style={{ background: BRAND, borderColor: BRAND, ['--tw-ring-color' as never]: BRAND }}
                    aria-label={playing ? "Pause" : "Play"}
                  >
                    {playing ? <Pause className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> : <Play className="h-4 w-4 translate-x-px sm:h-3.5 sm:w-3.5" />}
                  </button>
                  {/* Prev */}
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setTimelineToMs(timelineSteps[Math.max(0, stripIdx - 1)]);
                    }}
                    className="hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 sm:h-7 sm:w-7"
                    aria-label="Vorheriger Frame"
                  >
                    <ChevronLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </button>

                  {/* Jetzt — zurück auf aktuelle Messzeit */}
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setTimelineToMs(timelineSteps[stripNowIdx]);
                    }}
                    disabled={stripIdx === stripNowIdx}
                    className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 text-[11px] font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50 disabled:hover:bg-white sm:h-7 sm:px-2 sm:text-[10px]"
                    aria-label="Auf aktuelle Messzeit zurückspringen"
                  >
                    <Clock className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                    <span>Jetzt</span>
                  </button>


                  {/* Track */}
                  <div className="min-w-0 flex-1">
                    <FilmstripTimeline
                      frames={timelineSteps.map((ms) => ({ ms }))}
                      idx={stripIdx}
                      isMobile={isMobile}
                      playing={playing}
                      visualMs={stripMs}
                      color={timelineColorForMs(stripMs ?? timelineSteps[stripIdx] ?? Date.now())}
                      bandMode="measurement-forecast"
                      ariaLabel="Radar-Zeit"
                      formatBubble={(d) => fmtBubble(d, d.getTime() <= Date.now())}
                      onScrubMs={(ms) => {
                        setScrubVisualMs(ms);
                        if (ms !== null) setRenderMs(ms);
                      }}
                      onChange={(i: number) => {
                        setTimelineToMs(timelineSteps[i]);
                        setPlaying(false);
                      }}
                    />
                  </div>


                  {/* Next */}
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setTimelineToMs(
                        timelineSteps[Math.min(timelineSteps.length - 1, stripIdx + 1)],
                      );
                    }}

                    className="hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 sm:h-7 sm:w-7"
                    aria-label="Nächster Frame"
                  >
                    <ChevronRight className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </button>


                  {/* Einstellungen (Speed + Loop) */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 sm:h-7 sm:w-7"
                        aria-label="Wiedergabe-Einstellungen"
                      >
                        <Settings className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="top"
                      align="end"
                      sideOffset={8}
                      collisionPadding={12}
                      className="z-[1000] w-60 border-neutral-200 bg-white p-3 text-neutral-900 shadow-xl"
                    >
                      <div className="space-y-3">
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold text-neutral-600">
                            Geschwindigkeit
                          </p>
                          <div className="inline-flex w-full items-center rounded-full border border-neutral-200 bg-white p-0.5">
                            {[1, 2, 5, 10].map((s) => {
                              const active = speed === s;
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => setSpeed(s)}
                                  className={cn(
                                    "flex-1 rounded-full px-2 py-1 text-[11px] font-semibold transition",
                                    active ? "text-white shadow-sm" : "text-neutral-600 hover:text-neutral-900",
                                  )}
                                  style={active ? { background: BRAND } : undefined}
                                >
                                  {s}×
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={cn(
                              "text-[11px] font-semibold",
                              data?.hasHail ? "text-neutral-700" : "text-neutral-400",
                            )}>
                              Hagel (POH)
                            </p>
                            <p className="text-[10px] text-neutral-500">
                              {data?.hasHail ? "POH-Daten & bei Gewitter abgeleitet" : "Aktuell nicht verfügbar"}
                            </p>
                          </div>
                          <Switch
                            checked={showHail && !!data?.hasHail}
                            onCheckedChange={setShowHail}
                            disabled={!data?.hasHail}
                            aria-label="Hagel-Layer"
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {data?.warning && (
                  <p className="mt-1 truncate text-center text-[10px] text-neutral-500">
                    Hinweis: {data.warning}
                  </p>
                )}
              </>
            )}
          </div>
        </div>



      {/* Footnote unter der Karte */}
      {data && (
        <p className="px-3 text-[10px] text-neutral-500 sm:px-0">
          Aktualisiert am {fmtUpdatedAt(data.generatedAt)} · Quellen: MeteoSchweiz Radar (Messung &amp; Hagel-POH) · MeteoSchweiz ICON-CH1 (Nowcast) und ICON-seamless (Vorhersage bis +48 h) · Blitzortung.org (Blitze)
        </p>
      )}
    </div>
  );
}
