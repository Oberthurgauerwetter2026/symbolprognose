import { useEffect, useMemo, useRef, useState } from "react";
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
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { Pause, Play, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

import regionData from "@/data/region.json";
import lakeData from "@/data/lake.json";
import switzerlandData from "@/data/switzerland.json";
import thurgauData from "@/data/thurgau.json";


import { getWindFrames, type WindPayload, type WindFrame } from "@/lib/wind.functions";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const BRAND = "#2561a1";
const REGION = regionData as unknown as FeatureCollection;
const LAKE = lakeData as unknown as FeatureCollection;
const SWITZERLAND = switzerlandData as unknown as FeatureCollection;
const THURGAU = thurgauData as unknown as FeatureCollection;


// --- Böen-Farbskala (km/h, 5er-Schritte bis 40, dann 10er) ---
const WIND_SCALE: { v: number; rgb: [number, number, number]; label: string }[] = [
  { v: 0,   rgb: [ 60, 110, 190], label: "0"    },
  { v: 5,   rgb: [ 70, 145, 205], label: "5"    },
  { v: 10,  rgb: [ 80, 175, 200], label: "10"   },
  { v: 15,  rgb: [ 90, 195, 175], label: "15"   },
  { v: 20,  rgb: [110, 205, 140], label: "20"   },
  { v: 25,  rgb: [150, 215, 110], label: "25"   },
  { v: 30,  rgb: [200, 220,  90], label: "30"   },
  { v: 35,  rgb: [235, 215,  75], label: "35"   },
  { v: 40,  rgb: [245, 190,  65], label: "40"   },
  { v: 50,  rgb: [245, 155,  55], label: "50"   },
  { v: 60,  rgb: [240, 120,  55], label: "60"   },
  { v: 70,  rgb: [230,  80,  60], label: "70"   },
  { v: 80,  rgb: [200,  50,  85], label: "80"   },
  { v: 100, rgb: [150,  35, 135], label: "100+" },
];

function windColor(kmh: number): [number, number, number] {
  // Diskrete Bänder mit schmalem weichen Übergang (±2 km/h) an den Grenzen.
  const HALF = 2;
  let i = 0;
  for (let k = WIND_SCALE.length - 1; k >= 0; k--) {
    if (kmh >= WIND_SCALE[k].v) { i = k; break; }
  }
  const cur = WIND_SCALE[i];
  const next = WIND_SCALE[i + 1];
  if (next && kmh >= next.v - HALF) {
    const t = Math.min(1, Math.max(0, (kmh - (next.v - HALF)) / (HALF * 2)));
    return [
      Math.round(cur.rgb[0] + (next.rgb[0] - cur.rgb[0]) * t),
      Math.round(cur.rgb[1] + (next.rgb[1] - cur.rgb[1]) * t),
      Math.round(cur.rgb[2] + (next.rgb[2] - cur.rgb[2]) * t),
    ];
  }
  return cur.rgb;
}

// --- Outline / mask GeoJSON wie Radar ---
const OUTSIDE_MASK: FeatureCollection = (() => {
  const holes: number[][][] = [];
  for (const fc of [REGION, LAKE]) {
    for (const f of fc.features) {
      const g = f.geometry;
      if (!g) continue;
      if (g.type === "Polygon" && g.coordinates[0]) holes.push(g.coordinates[0]);
      else if (g.type === "MultiPolygon")
        for (const p of g.coordinates) if (p[0]) holes.push(p[0]);
    }
  }
  const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
  const feat: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [world, ...holes] },
  };
  return { type: "FeatureCollection", features: [feat] };
})();

const OUTSIDE_CH_MASK: FeatureCollection = (() => {
  const holes: number[][][] = [];
  for (const fc of [SWITZERLAND, LAKE]) {
    for (const f of fc.features) {
      const g = f.geometry;
      if (!g) continue;
      if (g.type === "Polygon" && g.coordinates[0]) holes.push(g.coordinates[0]);
      else if (g.type === "MultiPolygon")
        for (const p of g.coordinates) if (p[0]) holes.push(p[0]);
    }
  }
  const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
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

const WIND_CITIES: { name: string; lat: number; lon: number; minZoom?: number }[] = [
  // Tier A — Hauptorte (ab Zoom 10.5)
  { name: "Amriswil", lat: 47.5469, lon: 9.2986 },
  { name: "Romanshorn", lat: 47.5667, lon: 9.3786 },
  { name: "Arbon", lat: 47.5158, lon: 9.4339 },
  { name: "Horn", lat: 47.4986, lon: 9.4470 },
  { name: "Münsterlingen", lat: 47.6306, lon: 9.2378 },
  { name: "Egnach", lat: 47.5444, lon: 9.3833 },
  { name: "Güttingen", lat: 47.6011, lon: 9.2917 },
  // Tier B — mittelgrosse Gemeinden (ab Zoom 11.5)
  { name: "Roggwil", lat: 47.4769, lon: 9.3922, minZoom: 11.5 },
  { name: "Uttwil", lat: 47.5907, lon: 9.3367, minZoom: 11.5 },
  { name: "Salmsach", lat: 47.5503, lon: 9.3725, minZoom: 11.5 },
  { name: "Sommeri", lat: 47.5775, lon: 9.3194, minZoom: 11.5 },
  { name: "Erlen", lat: 47.5375, lon: 9.2378, minZoom: 11.5 },
  { name: "Langrickenbach", lat: 47.5947, lon: 9.2406, minZoom: 11.5 },
  // Tier C — kleine Gemeinden / Ortsteile (ab Zoom 12.5)
  { name: "Hefenhofen", lat: 47.5722, lon: 9.3289, minZoom: 12.5 },
  { name: "Dozwil", lat: 47.5867, lon: 9.3047, minZoom: 12.5 },
  { name: "Kesswil", lat: 47.6022, lon: 9.3217, minZoom: 12.5 },
  { name: "Hauptwil-Gottshaus", lat: 47.4894, lon: 9.2806, minZoom: 12.5 },
  { name: "Zihlschlacht-Sitterdorf", lat: 47.5158, lon: 9.2750, minZoom: 12.5 },
  { name: "Bischofszell", lat: 47.4944, lon: 9.2389, minZoom: 12.5 },
];

function cityIcon(name: string): L.DivIcon {
  const bullet =
    "font:600 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#2561a1;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;line-height:1;margin-right:4px;vertical-align:middle;";
  const label =
    "font:500 12px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;white-space:nowrap;vertical-align:middle;";
  return L.divIcon({
    className: "wind-city-marker",
    html: `<div style="display:flex;align-items:center;pointer-events:none;transform:translate(-3px,-7px);"><span style="${bullet}">•</span><span style="${label}">${name}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

const maxBoundsExt: L.LatLngBoundsExpression = [
  [46.80, 8.10],
  [48.35, 10.60],
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

// --- Bilineares Sampling auf dem Wind-Grid (gridLat aufsteigend, gridLon aufsteigend) ---
function makeSampler(payload: WindPayload, frame: WindFrame, nextFrame: WindFrame | null, t: number) {
  const { gridLat, gridLon } = payload;
  const nLat = gridLat.length;
  const nLon = gridLon.length;
  const lat0 = gridLat[0];
  const latN = gridLat[nLat - 1];
  const lon0 = gridLon[0];
  const lonN = gridLon[nLon - 1];

  const sampleArr = (arr: number[], fxRaw: number, fyRaw: number) => {
    const x0 = Math.floor(fxRaw);
    const y0 = Math.floor(fyRaw);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const tx = fxRaw - x0;
    const ty = fyRaw - y0;
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
      v00 * (1 - tx) * (1 - ty) +
      v01 * tx * (1 - ty) +
      v10 * (1 - tx) * ty +
      v11 * tx * ty
    );
  };

  const sample = (arr: number[], arrNext: number[] | null, lat: number, lon: number) => {
    const fx = ((lon - lon0) / (lonN - lon0)) * (nLon - 1);
    const fy = ((lat - lat0) / (latN - lat0)) * (nLat - 1);
    const a = sampleArr(arr, fx, fy);
    if (!arrNext) return a;
    const b = sampleArr(arrNext, fx, fy);
    const ease = t * t * (3 - 2 * t);
    return a + (b - a) * ease;
  };

  // Richtung sauber blenden (Vektor-Mittel, vermeidet 359→1 Sprünge).
  const sampleDir = (lat: number, lon: number) => {
    const dCur = sample(frame.dir, null, lat, lon);
    if (!nextFrame) return dCur;
    const dNxt = sampleArr(nextFrame.dir,
      ((lon - lon0) / (lonN - lon0)) * (nLon - 1),
      ((lat - lat0) / (latN - lat0)) * (nLat - 1));
    const ease = t * t * (3 - 2 * t);
    const ax = Math.cos((dCur * Math.PI) / 180);
    const ay = Math.sin((dCur * Math.PI) / 180);
    const bx = Math.cos((dNxt * Math.PI) / 180);
    const by = Math.sin((dNxt * Math.PI) / 180);
    const cx = ax + (bx - ax) * ease;
    const cy = ay + (by - ay) * ease;
    let d = (Math.atan2(cy, cx) * 180) / Math.PI;
    if (d < 0) d += 360;
    return d;
  };

  return {
    nLat,
    nLon,
    lat0,
    latN,
    lon0,
    lonN,
    gust: (lat: number, lon: number) => sample(frame.gust, nextFrame?.gust ?? null, lat, lon),
    speed: (lat: number, lon: number) => sample(frame.speed, nextFrame?.speed ?? null, lat, lon),
    dir: sampleDir,
  };
}

// --------------------------------------------------------------------------
// Color overlay — bilinear interpolated gust grid as canvas underlay.
// --------------------------------------------------------------------------
function WindColorOverlay({
  payload,
  frame,
  nextFrame,
  progress,
  opacity = 0.55,
}: {
  payload: WindPayload;
  frame: WindFrame;
  nextFrame: WindFrame | null;
  progress: number;
  opacity?: number;
}) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    const CanvasLayer = L.Layer.extend({
      onAdd(this: L.Layer & { _canvas?: HTMLCanvasElement }) {
        const pane = map.getPanes().overlayPane;
        const cv = L.DomUtil.create("canvas", "wind-color-canvas") as HTMLCanvasElement;
        cv.style.position = "absolute";
        cv.style.pointerEvents = "none";
        cv.style.willChange = "transform";
        cv.style.zIndex = "440";
        pane.appendChild(cv);
        this._canvas = cv;
        canvasRef.current = cv;
        map.on("moveend zoomend resize", redraw);
        redraw();
        return this;
      },
      onRemove(this: L.Layer & { _canvas?: HTMLCanvasElement }) {
        if (this._canvas) this._canvas.remove();
        map.off("moveend zoomend resize", redraw);
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
    if (!cv) return;
    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;
    cv.width = size.x * dpr;
    cv.height = size.y * dpr;
    cv.style.width = size.x + "px";
    cv.style.height = size.y + "px";
    cv.style.opacity = String(opacity);
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(cv, topLeft);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);

    const sampler = makeSampler(payload, frame, nextFrame, progress);
    const STEP = 1;
    const lowW = Math.max(1, Math.ceil(size.x / STEP));
    const lowH = Math.max(1, Math.ceil(size.y / STEP));
    const img = ctx.createImageData(lowW, lowH);
    const data = img.data;

    for (let ly = 0; ly < lowH; ly++) {
      for (let lx = 0; lx < lowW; lx++) {
        const px = lx * STEP;
        const py = ly * STEP;
        const ll = map.containerPointToLatLng([px, py]);
        if (
          ll.lat < sampler.lat0 - 0.1 ||
          ll.lat > sampler.latN + 0.1 ||
          ll.lng < sampler.lon0 - 0.1 ||
          ll.lng > sampler.lonN + 0.1
        )
          continue;
        const g = sampler.gust(ll.lat, ll.lng);
        const [r, gg, b] = windColor(g);
        const idx = (ly * lowW + lx) * 4;
        data[idx] = r;
        data[idx + 1] = gg;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    const off = document.createElement("canvas");
    off.width = lowW;
    off.height = lowH;
    const offCtx = off.getContext("2d");
    if (!offCtx) return;
    offCtx.putImageData(img, 0, 0);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, lowW, lowH, 0, 0, size.x, size.y);
    ctx.restore();
  };

  useEffect(() => {
    redrawRef.current();
  }, [frame, nextFrame, progress, opacity, payload]);

  return null;
}

// --------------------------------------------------------------------------
// Particle / tracer layer — many slow particles, subtle trails.
// --------------------------------------------------------------------------
interface Particle {
  x: number; // container px
  y: number;
  age: number;
  maxAge: number;
}

function WindParticleLayer({
  payload,
  frame,
  nextFrame,
  progress,
  enabled,
}: {
  payload: WindPayload;
  frame: WindFrame;
  nextFrame: WindFrame | null;
  progress: number;
  enabled: boolean;
}) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const frameRef = useRef<{ frame: WindFrame; next: WindFrame | null; progress: number }>({
    frame,
    next: nextFrame,
    progress,
  });
  const payloadRef = useRef<WindPayload>(payload);

  useEffect(() => {
    frameRef.current = { frame, next: nextFrame, progress };
  }, [frame, nextFrame, progress]);
  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  useEffect(() => {
    const CanvasLayer = L.Layer.extend({
      onAdd(this: L.Layer & { _canvas?: HTMLCanvasElement }) {
        const pane = map.getPanes().overlayPane;
        const cv = L.DomUtil.create("canvas", "wind-particle-canvas") as HTMLCanvasElement;
        cv.style.position = "absolute";
        cv.style.pointerEvents = "none";
        cv.style.willChange = "transform";
        cv.style.zIndex = "445";
        pane.appendChild(cv);
        this._canvas = cv;
        canvasRef.current = cv;
        const sync = () => syncSize(cv);
        sync();
        map.on("moveend zoomend resize", sync);
        return this;
      },
      onRemove(this: L.Layer & { _canvas?: HTMLCanvasElement }) {
        if (this._canvas) this._canvas.remove();
        canvasRef.current = null;
        return this;
      },
    });
    const layer = new (CanvasLayer as unknown as new () => L.Layer)();
    layer.addTo(map);

    function syncSize(cv: HTMLCanvasElement) {
      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;
      cv.width = size.x * dpr;
      cv.height = size.y * dpr;
      cv.style.width = size.x + "px";
      cv.style.height = size.y + "px";
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(cv, topLeft);
      const ctx = cv.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size.x, size.y);
      }
      particlesRef.current = [];
    }

    return () => {
      layer.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    if (!enabled) {
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      if (cv && ctx) ctx.clearRect(0, 0, cv.width, cv.height);
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const reduced = typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const tick = () => {
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;
      // Ensure transform stays in CSS px.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const sampler = makeSampler(
        payloadRef.current,
        frameRef.current.frame,
        frameRef.current.next,
        frameRef.current.progress,
      );

      // Density scales with viewport and inversely with zoom: more flow when zoomed out.
      const zoom = map.getZoom();
      const zoomFactor = Math.max(0.7, Math.min(1.4, 1.6 - (zoom - 9) * 0.15));
      const targetCount = Math.round(((size.x * size.y) / 3200) * zoomFactor);
      const particles = particlesRef.current;
      while (particles.length < targetCount) {
        particles.push({
          x: Math.random() * size.x,
          y: Math.random() * size.y,
          age: Math.random() * 80,
          maxAge: 70 + Math.random() * 60,
        });
      }
      if (particles.length > targetCount) particles.length = targetCount;

      // Fading trail (slower fade → longer streaks).
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, size.x, size.y);
      ctx.globalCompositeOperation = "source-over";

      ctx.lineCap = "round";

      // Movement scale: ~0.014 CSS px / (km/h) per frame → "many slow particles".
      const MOVE = reduced ? 0 : 0.014;
      const MAX_STEP = 2.2;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const ll = map.containerPointToLatLng([p.x, p.y]);
        if (
          ll.lat < sampler.lat0 ||
          ll.lat > sampler.latN ||
          ll.lng < sampler.lon0 ||
          ll.lng > sampler.lonN
        ) {
          p.x = Math.random() * size.x;
          p.y = Math.random() * size.y;
          p.age = 0;
          continue;
        }

        const sp = sampler.speed(ll.lat, ll.lng);
        const dr = sampler.dir(ll.lat, ll.lng);
        // meteorological direction: wind FROM dr → moves TOWARDS dr+180.
        const rad = ((dr + 180) * Math.PI) / 180;
        // screen: x → east, y → south.
        let dx = Math.sin(rad) * sp * MOVE;
        let dy = -Math.cos(rad) * sp * MOVE;
        const mag = Math.hypot(dx, dy);
        if (mag > MAX_STEP) {
          dx = (dx / mag) * MAX_STEP;
          dy = (dy / mag) * MAX_STEP;
        }

        const nx = p.x + dx;
        const ny = p.y + dy;
        // Dark halo for contrast over any color-layer hue.
        ctx.strokeStyle = "rgba(10,15,30,0.75)";
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        // Bright white core.
        ctx.strokeStyle = "rgba(255,255,255,1)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();


        p.x = nx;
        p.y = ny;
        p.age++;
        if (p.age > p.maxAge || nx < 0 || ny < 0 || nx > size.x || ny > size.y) {
          p.x = Math.random() * size.x;
          p.y = Math.random() * size.y;
          p.age = 0;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [enabled, map]);

  return null;
}

// --------------------------------------------------------------------------
// Arrow layer — small directional glyphs on a fixed pixel grid (zoom ≥ 11).
// --------------------------------------------------------------------------
function WindArrowLayer({
  payload,
  frame,
  nextFrame,
  progress,
  enabled,
}: {
  payload: WindPayload;
  frame: WindFrame;
  nextFrame: WindFrame | null;
  progress: number;
  enabled: boolean;
}) {
  const map = useMap();
  const z = useMapZoom();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const CanvasLayer = L.Layer.extend({
      onAdd(this: L.Layer & { _canvas?: HTMLCanvasElement }) {
        const pane = map.getPanes().overlayPane;
        const cv = L.DomUtil.create("canvas", "wind-arrow-canvas") as HTMLCanvasElement;
        cv.style.position = "absolute";
        cv.style.pointerEvents = "none";
        cv.style.willChange = "transform";
        cv.style.zIndex = "450";
        pane.appendChild(cv);
        this._canvas = cv;
        canvasRef.current = cv;
        map.on("moveend zoomend resize", redraw);
        return this;
      },
      onRemove(this: L.Layer & { _canvas?: HTMLCanvasElement }) {
        if (this._canvas) this._canvas.remove();
        map.off("moveend zoomend resize", redraw);
        canvasRef.current = null;
        return this;
      },
    });
    const layer = new (CanvasLayer as unknown as new () => L.Layer)();
    layer.addTo(map);
    return () => {
      layer.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const redrawRef = useRef<() => void>(() => {});
  function redraw() {
    redrawRef.current();
  }

  redrawRef.current = () => {
    const cv = canvasRef.current;
    if (!cv) return;
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);

    if (!enabled || z < 11) return;

    const sampler = makeSampler(payload, frame, nextFrame, progress);
    const STEP = z >= 13 ? 46 : 58;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let py = STEP / 2; py < size.y; py += STEP) {
      for (let px = STEP / 2; px < size.x; px += STEP) {
        const ll = map.containerPointToLatLng([px, py]);
        if (
          ll.lat < sampler.lat0 ||
          ll.lat > sampler.latN ||
          ll.lng < sampler.lon0 ||
          ll.lng > sampler.lonN
        )
          continue;
        const sp = sampler.speed(ll.lat, ll.lng);
        if (sp < 1) continue;
        const dr = sampler.dir(ll.lat, ll.lng);
        const rad = ((dr + 180) * Math.PI) / 180;
        const len = Math.max(3, Math.min(STEP * 0.9, sp * 0.55));
        const dx = Math.sin(rad) * len;
        const dy = -Math.cos(rad) * len;
        const x0 = px - dx / 2;
        const y0 = py - dy / 2;
        const x1 = px + dx / 2;
        const y1 = py + dy / 2;

        ctx.strokeStyle = "rgba(20,30,50,0.85)";
        ctx.lineWidth = Math.max(1.0, Math.min(2.0, 1.0 + sp * 0.015));
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        // Arrow head
        const ah = Math.max(2.5, Math.min(7, len * 0.28));
        const ang = Math.atan2(dy, dx);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - ah * Math.cos(ang - 0.5), y1 - ah * Math.sin(ang - 0.5));
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - ah * Math.cos(ang + 0.5), y1 - ah * Math.sin(ang + 0.5));
        ctx.stroke();
      }
    }
  };

  useEffect(() => {
    redrawRef.current();
  }, [payload, frame, nextFrame, progress, z, enabled]);

  return null;
}

// --------------------------------------------------------------------------
// Hover tooltip — speed (km/h) + direction.
// --------------------------------------------------------------------------
function dirCardinal(deg: number): string {
  const dirs = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

function WindHoverTooltip({
  payload,
  frame,
  nextFrame,
  progress,
}: {
  payload: WindPayload;
  frame: WindFrame;
  nextFrame: WindFrame | null;
  progress: number;
}) {
  const map = useMap();
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [info, setInfo] = useState<{ x: number; y: number; gust: number; speed: number; dir: number } | null>(null);

  useEffect(() => {
    const onMove = (e: L.LeafletMouseEvent) => {
      const sampler = makeSampler(payload, frame, nextFrame, progress);
      const { lat, lng } = e.latlng;
      if (
        lat < sampler.lat0 ||
        lat > sampler.latN ||
        lng < sampler.lon0 ||
        lng > sampler.lonN
      ) {
        setInfo(null);
        return;
      }
      setInfo({
        x: e.containerPoint.x,
        y: e.containerPoint.y,
        gust: sampler.gust(lat, lng),
        speed: sampler.speed(lat, lng),
        dir: sampler.dir(lat, lng),
      });
    };
    const onOut = () => setInfo(null);
    map.on("mousemove", onMove);
    map.on("mouseout", onOut);
    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", onOut);
    };
  }, [map, payload, frame, nextFrame, progress]);

  if (!info) return null;
  const size = map.getSize();
  const xRight = info.x > size.x - 160;
  const yBottom = info.y > size.y - 80;
  return (
    <div
      ref={tipRef}
      className="pointer-events-none absolute z-[460] rounded-md bg-white/95 px-2 py-1.5 text-[11px] font-medium shadow-md ring-1 ring-black/5"
      style={{
        left: xRight ? info.x - 12 : info.x + 12,
        top: yBottom ? info.y - 8 : info.y + 12,
        transform: xRight ? "translateX(-100%)" : undefined,
      }}
    >
      <div className="font-semibold text-neutral-900">
        Böen {Math.round(info.gust)} km/h
      </div>
      <div className="text-neutral-600">
        Mittel {Math.round(info.speed)} km/h · {dirCardinal(info.dir)} ({Math.round(info.dir)}°)
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Timeline (simplified version of radar timeline)
// --------------------------------------------------------------------------
function fmtBubble(d: Date): string {
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `Prognose: ${wd}, ${hh}:${mm}`;
}

function WindTimeline({
  frames,
  idx,
  onChange,
  isMobile,
}: {
  frames: WindFrame[];
  idx: number;
  onChange: (i: number) => void;
  isMobile: boolean;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const times = useMemo(() => frames.map((f) => Date.parse(f.t)), [frames]);
  const tMin = times[0] ?? 0;
  const tMax = times[times.length - 1] ?? 1;
  const span = Math.max(1, tMax - tMin);

  const pctForMs = (ms: number) => Math.max(0, Math.min(100, ((ms - tMin) / span) * 100));
  const pctForIdx = (i: number) => pctForMs(times[i] ?? tMin);

  const idxFromClientX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return idx;
    const r = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const target = tMin + pct * span;
    let best = 0;
    let bestDt = Infinity;
    for (let i = 0; i < times.length; i++) {
      const dt = Math.abs(times[i] - target);
      if (dt < bestDt) {
        bestDt = dt;
        best = i;
      }
    }
    return best;
  };

  const hourTicks = useMemo(() => {
    const startMs = Math.ceil(tMin / 3600000) * 3600000;
    const out: { ms: number; pct: number; hour: number }[] = [];
    for (let t = startMs; t <= tMax; t += 3600000) {
      const d = new Date(t);
      out.push({ ms: t, pct: pctForMs(t), hour: d.getHours() });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tMin, tMax]);

  const handlePct = pctForIdx(idx);
  const bubble = fmtBubble(new Date(times[idx] ?? Date.now()));
  const labelStep = isMobile ? 3 : 2;

  return (
    <div className="select-none">
      <div className="relative pt-5 pb-2">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-4">
          {hourTicks.map((t, i) => {
            if (i % labelStep !== 0) return null;
            return (
              <span
                key={t.ms}
                className="absolute -translate-x-1/2 text-[9px] font-medium tabular-nums text-neutral-500"
                style={{ left: `${t.pct}%`, top: 0 }}
              >
                {String(t.hour).padStart(2, "0")}
              </span>
            );
          })}
        </div>
        <div
          ref={trackRef}
          role="slider"
          aria-label="Windprognose-Zeit"
          aria-valuemin={0}
          aria-valuemax={frames.length - 1}
          aria-valuenow={idx}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              onChange(Math.max(0, idx - 1));
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              onChange(Math.min(frames.length - 1, idx + 1));
            }
          }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setDragging(true);
            onChange(idxFromClientX(e.clientX));
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            onChange(idxFromClientX(e.clientX));
          }}
          onPointerUp={(e) => {
            setDragging(false);
            try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* */ }
          }}
          className="relative flex h-7 w-full cursor-pointer touch-none items-center outline-none rounded"
        >
          <div className="relative h-[4px] w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${handlePct}%`, background: BRAND, opacity: 0.9 }}
            />
            {hourTicks.map((t) => (
              <span
                key={`ht-${t.ms}`}
                className="absolute top-0 h-full w-px bg-neutral-300"
                style={{ left: `${t.pct}%` }}
              />
            ))}
          </div>
          <div
            className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${handlePct}%` }}
          >
            <div className="relative h-6 w-[2px] rounded-sm bg-neutral-900/70">
              <div
                className="absolute left-1/2 top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
                style={{ background: BRAND }}
              />
            </div>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <span
                className="whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
                style={{ background: BRAND }}
              >
                {bubble}
              </span>
              <span
                className="h-0 w-0"
                style={{
                  borderLeft: "4px solid transparent",
                  borderRight: "4px solid transparent",
                  borderTop: `4px solid ${BRAND}`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Main map
// --------------------------------------------------------------------------
type DisplayMode = "flow" | "arrows" | "both";

export function WindMap({ bare = false }: { bare?: boolean } = {}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["wind-frames"],
    queryFn: () => getWindFrames(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const frames = data?.frames ?? [];
  const [idx, setIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [progress, setProgress] = useState(0);
  const [arrowsOn, setArrowsOn] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (idx === null && frames.length > 0) setIdx(0);
  }, [frames.length, idx]);

  useEffect(() => {
    if (!playing || frames.length === 0) {
      setProgress(0);
      return;
    }
    const FRAME_MS = 1800 / speed;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setProgress((p) => {
        const np = p + dt / FRAME_MS;
        if (np >= 1) {
          setIdx((cur) => {
            if (cur === null) return 0;
            const next = cur + 1;
            if (next >= frames.length) {
              return 0;
            }
            return next;

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

  const currentFrame = idx !== null ? frames[idx] ?? null : null;
  const nextFrame = playing && idx !== null && currentFrame
    ? frames[idx + 1] ?? null
    : null;
  const showFlow = true;
  const showArrows = arrowsOn;

  return (
    <div className={cn("@container", bare ? "flex h-full w-full flex-col" : "space-y-3")}>
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
          minZoom={8}
          maxZoom={15}
          scrollWheelZoom
          zoomControl={false}
          attributionControl
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

          {data && currentFrame && (
            <>
              <WindColorOverlay
                payload={data}
                frame={currentFrame}
                nextFrame={nextFrame}
                progress={progress}
              />
              <WindParticleLayer
                payload={data}
                frame={currentFrame}
                nextFrame={nextFrame}
                progress={progress}
                enabled={showFlow}
              />
              <WindArrowLayer
                payload={data}
                frame={currentFrame}
                nextFrame={nextFrame}
                progress={progress}
                enabled={showArrows}
              />
              <WindHoverTooltip
                payload={data}
                frame={currentFrame}
                nextFrame={nextFrame}
                progress={progress}
              />
            </>
          )}

          {WIND_CITIES.map((c) => (
            <ZoomGate key={c.name} minZoom={c.minZoom ?? 10.5}>
              <Marker
                position={[c.lat, c.lon]}
                icon={cityIcon(c.name)}
                interactive={false}
                keyboard={false}
              />
            </ZoomGate>
          ))}
          <ZoomControl position="topright" />
        </MapContainer>

        {/* Quellen-Badge */}
        <div className="pointer-events-none absolute left-3 top-3 z-[400] flex flex-col gap-1">
          <span
            className="rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-md"
            style={{ background: BRAND }}
          >
            Modellprognose
          </span>
          {currentFrame && (
            <span className="rounded-md bg-card/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-md">
              {new Intl.DateTimeFormat("de-CH", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(currentFrame.t))}
            </span>
          )}
        </div>

        {/* Legende */}
        <div className="pointer-events-none absolute right-3 top-24 z-[400] flex flex-col gap-0.5 rounded-md bg-card/95 p-1.5 text-[9px] shadow-md sm:p-2 sm:text-[10px]">
          <span className="mb-1 font-semibold text-foreground">Böen km/h</span>
          {[...WIND_SCALE].reverse().map((s) => (
            <div key={s.v} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-3 rounded-sm sm:h-2.5 sm:w-4"
                style={{ background: `rgb(${s.rgb.join(",")})` }}
              />
              <span className="tabular-nums text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Steuerung */}
        <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[450] sm:inset-x-3 sm:bottom-3">
          <div className="pointer-events-auto rounded-xl border border-neutral-200/80 bg-white/90 p-2 text-neutral-900 shadow-lg backdrop-blur sm:p-2.5">
            {isLoading && (
              <p className="text-center text-xs text-neutral-500">Lade Winddaten …</p>
            )}
            {error && (
              <p className="text-center text-xs text-red-600">
                Winddaten konnten nicht geladen werden.
              </p>
            )}
            {data && frames.length === 0 && !isLoading && (
              <p className="text-center text-xs text-neutral-500">
                {data.warning ?? "Keine Prognosedaten verfügbar."}
              </p>
            )}

            {data && frames.length > 0 && idx !== null && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-white shadow-sm transition hover:brightness-110 sm:h-7 sm:w-7"
                  style={{ background: BRAND, borderColor: BRAND }}
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <Pause className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> : <Play className="h-4 w-4 translate-x-px sm:h-3.5 sm:w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => { setPlaying(false); setIdx((cur) => Math.max(0, (cur ?? 0) - 1)); }}
                  className="hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 sm:h-7 sm:w-7"
                  aria-label="Vorheriger Frame"
                >
                  <ChevronLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </button>
                <div className="min-w-0 flex-1">
                  <WindTimeline
                    frames={frames}
                    idx={idx}
                    isMobile={isMobile}
                    onChange={(i) => { setIdx(i); setPlaying(false); }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setPlaying(false); setIdx((cur) => Math.min(frames.length - 1, (cur ?? 0) + 1)); }}
                  className="hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 sm:h-7 sm:w-7"
                  aria-label="Nächster Frame"
                >
                  <ChevronRight className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </button>

                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 sm:h-7 sm:w-7"
                      aria-label="Einstellungen"
                    >
                      <Settings className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="end"
                    sideOffset={8}
                    collisionPadding={12}
                    className="z-[1000] w-64 border-neutral-200 bg-white p-3 text-neutral-900 shadow-xl"
                  >
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <label htmlFor="wind-arrows-toggle" className="text-[11px] font-semibold text-neutral-600">
                            Windpfeile
                          </label>
                          <Switch
                            id="wind-arrows-toggle"
                            checked={arrowsOn}
                            onCheckedChange={setArrowsOn}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-neutral-500">Pfeile werden ab Zoom 11 sichtbar.</p>
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold text-neutral-600">Geschwindigkeit</p>
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
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>
      </div>

      {data && (
        <p className="px-3 text-[10px] text-neutral-500 sm:px-0">
          Aktualisiert am {new Intl.DateTimeFormat("de-CH", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          }).format(new Date(data.generatedAt))} · Quelle: MeteoSchweiz ICON-CH1 → ICON-CH2 via Open-Meteo — stündliche Windböen 10 m, +0 … +48 h
          {data.warning ? ` · Hinweis: ${data.warning}` : ""}
        </p>
      )}
    </div>
  );
}
