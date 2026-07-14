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
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { Pause, Play, ChevronLeft, ChevronRight, Settings, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";


import regionData from "@/data/region.json";
import lakeData from "@/data/lake.json";
import switzerlandData from "@/data/switzerland.json";
import thurgauData from "@/data/thurgau.json";

import { getRadarFrames, type RadarPayload, type RadarFrame } from "@/lib/radar.functions";
import { cn } from "@/lib/utils";
import { FilmstripTimeline } from "./filmstrip-timeline";
import { OBERTHURGAU_PLACES } from "@/data/oberthurgau-places";




const BRAND = "#2561a1";
const MEASUREMENT_COLOR = "#1f7a3a";
const FORECAST_COLOR = BRAND;
const FILMSTRIP_MEASUREMENT_COLOR = "#9ca3af";
const FILMSTRIP_FORECAST_COLOR = BRAND;
const REGION = regionData as unknown as FeatureCollection;
const LAKE = lakeData as unknown as FeatureCollection;
const SWITZERLAND = switzerlandData as unknown as FeatureCollection;
const THURGAU = thurgauData as unknown as FeatureCollection;

const RADAR_CITIES = OBERTHURGAU_PLACES;


function cityIcon(name: string): L.DivIcon {
  const bullet =
    "font:600 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#2561a1;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;line-height:1;margin-right:4px;vertical-align:middle;";
  const label =
    "font:500 12px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;white-space:nowrap;vertical-align:middle;";
  return L.divIcon({
    className: "radar-city-marker",
    html: `<div style="display:flex;align-items:center;pointer-events:none;transform:translate(-3px,-7px);"><span style="${bullet}">•</span><span style="${label}">${name}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}


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

// Weiche Farbskala für Prognose-Frames — linear zwischen zwei Bändern blenden,
// damit die ICON-CH1-Felder nicht als rechteckige Blöcke wirken.
function colorForSmooth(mmh: number): [number, number, number, number] {
  if (mmh < SCALE[0].mmh) return [0, 0, 0, 0];
  if (mmh >= SCALE[SCALE.length - 1].mmh) {
    const last = SCALE[SCALE.length - 1];
    return [last.rgb[0], last.rgb[1], last.rgb[2], last.a];
  }
  for (let i = 0; i < SCALE.length - 1; i++) {
    const lo = SCALE[i];
    const hi = SCALE[i + 1];
    if (mmh >= lo.mmh && mmh < hi.mmh) {
      // log-Interpolation, weil die Skala selbst log-artig ist (0.1→0.3→0.8→2…).
      const tt =
        (Math.log(mmh) - Math.log(lo.mmh)) /
        (Math.log(hi.mmh) - Math.log(lo.mmh));
      const t = Math.max(0, Math.min(1, tt));
      return [
        Math.round(lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * t),
        Math.round(lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * t),
        Math.round(lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * t),
        lo.a + (hi.a - lo.a) * t,
      ];
    }
  }
  return [0, 0, 0, 0];
}


// ---------------------------------------------------------------------------
// Organische Radar-Echo-Optik für die Prognose:
// Domain-Warp + feine Intensitäts-Modulation aus deterministischem Value-Noise
// verwandeln die glatten, kapselförmigen Grid-Blobs in unregelmäßige, an den
// Rändern ausgefranste Zellen, ohne die Position der Datenfelder zu verfälschen.
// Zusätzlich entfernt eine morphologische Öffnung isolierte Streu-Pixel.
// Alle Funktionen sind ausschliesslich für den Prognose-Renderpfad gedacht —
// Messung bleibt unangetastet.
// ---------------------------------------------------------------------------

function _hash3i(x: number, y: number, z: number): number {
  let h = ((x | 0) * 374761393) ^ ((y | 0) * 668265263) ^ ((z | 0) * 1442695040);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

function _valueNoise2Int(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const n00 = _hash3i(xi, yi, z);
  const n10 = _hash3i(xi + 1, yi, z);
  const n01 = _hash3i(xi, yi + 1, z);
  const n11 = _hash3i(xi + 1, yi + 1, z);
  const nx0 = n00 * (1 - u) + n10 * u;
  const nx1 = n01 * (1 - u) + n11 * u;
  return nx0 * (1 - v) + nx1 * v;
}

function valueNoise2(x: number, y: number, z: number): number {
  const zi = Math.floor(z);
  const zf = z - zi;
  const a = _valueNoise2Int(x, y, zi);
  const b = _valueNoise2Int(x, y, zi + 1);
  return a * (1 - zf) + b * zf;
}

function fbm2(x: number, y: number, z: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x * freq, y * freq, z);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

const _DENOISE_CACHE: WeakMap<object, number[]> = new WeakMap();
function denoiseGrid(
  vals: number[] | undefined,
  nLon: number,
  nLat: number,
  threshold = 0.1,
  minNb = 2,
): number[] | undefined {
  if (!vals || vals.length !== nLon * nLat) return vals;
  const key = vals as unknown as object;
  const cached = _DENOISE_CACHE.get(key);
  if (cached) return cached;
  const out = new Array<number>(vals.length);
  for (let y = 0; y < nLat; y++) {
    for (let x = 0; x < nLon; x++) {
      const i = y * nLon + x;
      const v = vals[i];
      if (v < threshold) {
        out[i] = v;
        continue;
      }
      let nb = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= nLat) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= nLon) continue;
          if (vals[yy * nLon + xx] >= threshold) nb++;
        }
      }
      out[i] = nb < minNb ? 0 : v;
    }
  }
  _DENOISE_CACHE.set(key, out);
  return out;
}

/**
 * Domain-Warp: verzerrt (fxRaw, fyRaw) mit einem niederfrequenten fBm-Feld,
 * damit die Radar-Echos organisch ausgefranste Ränder bekommen. Amplitude
 * in Grid-Zellen, Zeitachse `z` sorgt für langsame, atmende Deformation.
 * Nur für Prognose-Frames aufrufen.
 */
function warpSample(
  fx: number,
  fy: number,
  z: number,
  ampCells = 0.55,
): [number, number] {
  const wx = fbm2(fx * 0.85, fy * 0.85, z, 2);
  const wy = fbm2(fx * 0.85 + 31.7, fy * 0.85 + 17.3, z, 2);
  return [fx + wx * ampCells, fy + wy * ampCells];
}

/**
 * Feine Intensitäts-Modulation nahe der Isolinien — erzeugt zusätzliche
 * Zipfel/Fransen an den Bandgrenzen von `colorFor`, ohne dichte Kerne
 * sichtbar zu ändern.
 */
function edgeJitter(fx: number, fy: number, z: number): number {
  return 1 + 0.12 * valueNoise2(fx * 2.1, fy * 2.1, z * 3 + 1);
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

// Etwas grösser als die erweiterte Daten-Bbox (46.85–48.30 / 8.15–10.55), damit der
// Standardausschnitt knapp drüber liegt.
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

// Optical-Flow (Horn–Schunck) zwischen zwei Prognose-Feldern auf dem nativen
// ICON-Grid. Ergebnis: Verschiebungsfeld (u,v) in Gridindex-Einheiten pro
// vollem Framepaar-Gap. Wird pro Framepaar einmal berechnet und in einer
// modulweiten LRU-Map gecacht, damit das Morphing beim Play/Scrub nur
// noch zweimal warpend samplet (bidirektionales Bild-Morphing).
type FlowField = { u: Float32Array; v: Float32Array; w: number; h: number };
const FLOW_CACHE = new Map<string, FlowField>();
const FLOW_CACHE_MAX = 32;

function computeHornSchunckFlow(
  aVals: number[] | Float32Array,
  bVals: number[] | Float32Array,
  w: number,
  h: number,
  iters = 40,
  alpha2 = 4,
): FlowField {
  // log(1+v) skaliert die Skala (0.1 … 80 mm/h) auf einen kompakten Bereich
  // und stabilisiert die Gradienten für Horn–Schunck.
  const n = w * h;
  const I1 = new Float32Array(n);
  const I2 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    I1[i] = Math.log1p(Math.max(0, aVals[i] ?? 0));
    I2[i] = Math.log1p(Math.max(0, bVals[i] ?? 0));
  }
  const Ix = new Float32Array(n);
  const Iy = new Float32Array(n);
  const It = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const xL = x > 0 ? x - 1 : x;
      const xR = x < w - 1 ? x + 1 : x;
      const yU = y > 0 ? y - 1 : y;
      const yD = y < h - 1 ? y + 1 : y;
      Ix[i] = ((I1[y * w + xR] - I1[y * w + xL]) + (I2[y * w + xR] - I2[y * w + xL])) * 0.25;
      Iy[i] = ((I1[yD * w + x] - I1[yU * w + x]) + (I2[yD * w + x] - I2[yU * w + x])) * 0.25;
      It[i] = I2[i] - I1[i];
    }
  }
  const u = new Float32Array(n);
  const v = new Float32Array(n);
  const uBar = new Float32Array(n);
  const vBar = new Float32Array(n);
  for (let k = 0; k < iters; k++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const xL = x > 0 ? x - 1 : x;
        const xR = x < w - 1 ? x + 1 : x;
        const yU = y > 0 ? y - 1 : y;
        const yD = y < h - 1 ? y + 1 : y;
        uBar[i] = (u[y * w + xL] + u[y * w + xR] + u[yU * w + x] + u[yD * w + x]) * 0.25;
        vBar[i] = (v[y * w + xL] + v[y * w + xR] + v[yU * w + x] + v[yD * w + x]) * 0.25;
      }
    }
    for (let i = 0; i < n; i++) {
      const num = Ix[i] * uBar[i] + Iy[i] * vBar[i] + It[i];
      const den = alpha2 + Ix[i] * Ix[i] + Iy[i] * Iy[i];
      const f = num / den;
      u[i] = uBar[i] - Ix[i] * f;
      v[i] = vBar[i] - Iy[i] * f;
    }
  }
  return { u, v, w, h };
}

function getFlowField(
  a: RadarFrame,
  b: RadarFrame,
  w: number,
  h: number,
): FlowField | null {
  if (!a.values || !b.values || a.values.length !== w * h || b.values.length !== w * h) {
    return null;
  }
  const key = `${a.t}|${b.t}`;
  const hit = FLOW_CACHE.get(key);
  if (hit) {
    FLOW_CACHE.delete(key);
    FLOW_CACHE.set(key, hit);
    return hit;
  }
  const flow = computeHornSchunckFlow(a.values, b.values, w, h);
  FLOW_CACHE.set(key, flow);
  while (FLOW_CACHE.size > FLOW_CACHE_MAX) {
    const firstKey = FLOW_CACHE.keys().next().value;
    if (firstKey === undefined) break;
    FLOW_CACHE.delete(firstKey);
  }
  return flow;
}

function sampleBilinear(
  arr: number[] | Float32Array,
  fx: number,
  fy: number,
  w: number,
  h: number,
): number {
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = fx - x0;
  const ty = fy - y0;
  const inX0 = x0 >= 0 && x0 < w;
  const inX1 = x1 >= 0 && x1 < w;
  const inY0 = y0 >= 0 && y0 < h;
  const inY1 = y1 >= 0 && y1 < h;
  if ((!inX0 && !inX1) || (!inY0 && !inY1)) return 0;
  const v00 = inX0 && inY0 ? arr[y0 * w + x0] : 0;
  const v01 = inX1 && inY0 ? arr[y0 * w + x1] : 0;
  const v10 = inX0 && inY1 ? arr[y1 * w + x0] : 0;
  const v11 = inX1 && inY1 ? arr[y1 * w + x1] : 0;
  return (
    v00 * (1 - tx) * (1 - ty) +
    v01 * tx * (1 - ty) +
    v10 * (1 - tx) * ty +
    v11 * tx * ty
  );
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
  const blendCanvasRef = useRef<HTMLCanvasElement | null>(null);


  const redrawRef = useRef<() => void>(() => {});
  const redrawScheduledRef = useRef<number | null>(null);
  function redraw() {
    if (redrawScheduledRef.current !== null) return;
    redrawScheduledRef.current = requestAnimationFrame(() => {
      redrawScheduledRef.current = null;
      redrawRef.current();
    });
  }
  // Invalidiere Cache bei Pan/Zoom/Resize — alle Einträge betreffen alte View.
  useEffect(() => {
    const clear = () => {
      cacheRef.current.clear();
      lookupRef.current = null;
      viewKeyRef.current = "";
    };
    map.on("zoomstart movestart resize", clear);
    return () => {
      map.off("zoomstart movestart resize", clear);
    };
  }, [map]);

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
    const isForecastFrame = frame.source !== "radar";
    const rawVals = frame.values;
    const rawSnow = frame.snowValues;
    const vals = rawVals;
    const snowVals = rawSnow;
    const zSlot = 0;
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


    const cacheKey = `${frame.t}|${frame.source ?? ""}`;
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

    const nf = nextFrameRef.current;
    const prog = progressRef.current;
    const blendActive =
      !!nf &&
      prog > 0 &&
      prog < 1 &&
      !!nf.t &&
      nf.t !== frame.t &&
      !!frame.values &&
      frame.values.length > 0 &&
      !!nf.values &&
      nf.values.length > 0;
    const blended = blendActive && nf ? buildBlendedOffscreenRef.current(frame, nf, prog) : null;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (blended) {
      // Kontinuierlicher Zwischenzustand exakt zwischen den beiden
      // Nachbarframes: gleiche Position/Geometrie, linear interpolierte
      // Intensität. Keine künstliche Verschiebung.
      ctx.drawImage(blended, 0, 0, blended.width, blended.height, 0, 0, size.x, size.y);
    } else {
      ctx.drawImage(off, 0, 0, lowW, lowH, 0, 0, size.x, size.y);
      // Fallback nur für fehlende Grid-Werte; reguläre Frames laufen über den
      // Intensitäts-Zwischenzustand oben.
      if (nf && prog > 0 && nf.t !== frame.t) {
        const nextOff = buildOffscreenRef.current(nf);
        if (nextOff) {
          ctx.globalAlpha = Math.min(1, Math.max(0, prog));
          ctx.drawImage(nextOff, 0, 0, nextOff.width, nextOff.height, 0, 0, size.x, size.y);
          ctx.globalAlpha = 1;
        }
      }
    }
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
    const isForecastFrame = f.source !== "radar";
    const rawVals = f.values;
    const rawSnow = f.snowValues;
    const vals = isForecastFrame
      ? denoiseGrid(rawVals, nLon, nLat) ?? rawVals
      : rawVals;
    const snowVals = isForecastFrame
      ? denoiseGrid(rawSnow, nLon, nLat) ?? rawSnow
      : rawSnow;
    const zSlot = isForecastFrame ? Date.parse(f.t) / 900000 : 0;
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
          : isForecastFrame
            ? colorForSmooth(v)
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

  // Kontinuierlicher Zwischenframe zwischen zwei Datenframes a→b mit Progress
  // p ∈ (0,1). Es werden ausschliesslich die beiden Nachbarframes an derselben
  // Kartenposition gesampelt und deren Intensitäten interpoliert.
  const buildBlendedOffscreenRef = useRef<
    (a: RadarFrame, b: RadarFrame, p: number) => HTMLCanvasElement | null
  >(() => null);
  buildBlendedOffscreenRef.current = (
    a: RadarFrame,
    b: RadarFrame,
    p: number,
  ): HTMLCanvasElement | null => {
    const lookup = lookupRef.current;
    if (!lookup) return null;
    const rawAVals = a.values;
    const rawBVals = b.values;
    if (!rawAVals || rawAVals.length === 0 || !rawBVals || rawBVals.length === 0) return null;
    const nLatEarly = payload.gridLat.length;
    const nLonEarly = payload.gridLon.length;
    const isForecastPair = a.source !== "radar" || b.source !== "radar";
    const aVals = isForecastPair
      ? denoiseGrid(rawAVals, nLonEarly, nLatEarly) ?? rawAVals
      : rawAVals;
    const bVals = isForecastPair
      ? denoiseGrid(rawBVals, nLonEarly, nLatEarly) ?? rawBVals
      : rawBVals;
    const { gridLat, gridLon } = payload;
    const nLat = gridLat.length;
    const nLon = gridLon.length;

    const s = Math.max(0, Math.min(1, p));
    const oneMinusS = 1 - s;

    const lowW = lookup.lowW;
    const lowH = lookup.lowH;
    let mc = blendCanvasRef.current;
    if (!mc || mc.width !== lowW || mc.height !== lowH) {
      mc = document.createElement("canvas");
      mc.width = lowW;
      mc.height = lowH;
      blendCanvasRef.current = mc;
    }
    const offCtx = mc.getContext("2d");
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

    const rawASnow = a.snowValues;
    const rawBSnow = b.snowValues;
    const aSnow = isForecastPair
      ? denoiseGrid(rawASnow, nLon, nLat) ?? rawASnow
      : rawASnow;
    const bSnow = isForecastPair
      ? denoiseGrid(rawBSnow, nLon, nLat) ?? rawBSnow
      : rawBSnow;

    // Zeit-Slot für den Domain-Warp: zwischen A und B linear interpoliert,
    // damit die organische Deformation über den Framewechsel driftet, statt
    // zu springen.
    const zA = Date.parse(a.t) / 900000;
    const zB = Date.parse(b.t) / 900000;
    const zSlot = zA + (zB - zA) * s;

    // Optical-Flow (Horn–Schunck) auf dem nativen Grid — Cache pro Framepaar.
    // Wenn Flow (noch) nicht verfügbar (falsche Grid-Länge, erster Aufruf im
    // gleichen Tick), fällt der Warp still auf reine Intensitäts-Interpolation
    // zurück.
    const flow = getFlowField(a, b, nLon, nLat);
    const warpAdx = flow ? -s : 0;
    const warpAdy = flow ? -s : 0;
    const warpBdx = flow ? 1 - s : 0;
    const warpBdy = flow ? 1 - s : 0;

    for (let ly = 0; ly < lowH; ly++) {
      for (let lx = 0; lx < lowW; lx++) {
        const cell = ly * lowW + lx;
        if (!lookup.valid[cell]) continue;
        const fxRaw = lookup.fx[cell];
        const fyRaw = lookup.fy[cell];

        let ux = 0;
        let uy = 0;
        if (flow) {
          ux = sampleBilinear(flow.u, fxRaw, fyRaw, nLon, nLat);
          uy = sampleBilinear(flow.v, fxRaw, fyRaw, nLon, nLat);
        }

        // Bidirektionaler Warp: A entlang +u nach vorn geschoben, B entlang −u
        // zurückgeschoben, so dass korrespondierende Echos sich zwischen A und
        // B linear in ihrer Position bewegen.
        const aSx = fxRaw + ux * warpAdx;
        const aSy = fyRaw + uy * warpAdy;
        const bSx = fxRaw + ux * warpBdx;
        const bSy = fyRaw + uy * warpBdy;

        const va = sampleAt(aVals, aSx, aSy);
        const vb = sampleAt(bVals, bSx, bSy);
        let v = oneMinusS * va + s * vb;
        const minV = 0.1;
        if (v < minV) continue;

        let snowFrac = 0;
        if (aSnow || bSnow) {
          const sa = aSnow ? sampleAt(aSnow, aSx, aSy) : 0;
          const sb = bSnow ? sampleAt(bSnow, bSx, bSy) : 0;
          const sv = oneMinusS * sa + s * sb;
          if (v > 0.01) snowFrac = Math.max(0, Math.min(1, sv / v));
        }

        const [rC, gC, bC, aC] = snowFrac > 0.3
          ? snowColorFor(v)
          : isForecastPair
            ? colorForSmooth(v)
            : colorFor(v);
        if (aC === 0) continue;
        const alpha = Math.round(aC * 255);
        if (alpha === 0) continue;
        const pix = cell * 4;
        data[pix] = rC;
        data[pix + 1] = gC;
        data[pix + 2] = bC;
        data[pix + 3] = alpha;
      }
    }
    offCtx.putImageData(img, 0, 0);
    return mc;
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
  bounds,
  opacity,
  prefetchUrls,
}: {
  url: string;
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  opacity: number;
  prefetchUrls?: string[];
}) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<L.Layer | null>(null);
  type DecodedRadar = { w: number; h: number; mmh: Float32Array; smoothMmh?: Float32Array };
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
    if (src.smoothMmh) return src.smoothMmh;
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
            sum += src.mmh[yy * sw + xx];
            cnt++;
          }
        }
        smooth[y * sw + x] = cnt > 0 ? sum / cnt : 0;
      }
    }
    src.smoothMmh = smooth;
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

  // PNG → mm/h-Grid decoding mit LRU-Cache pro Quell-URL.
  useEffect(() => {
    const cached = cacheRef.current.get(url);
    if (cached) {
      // Reinsert to mark as recent.
      cacheRef.current.delete(url);
      cacheRef.current.set(url, cached);
      sourceRef.current = cached;
      redraw();
      return;
    }
    let cancelled = false;
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
      for (let i = 0; i < cw * ch; i++) {
        const o = i * 4;
        const a = data[o + 3];
        if (a < 8) {
          mmh[i] = 0;
          continue;
        }
        const r = data[o];
        const g = data[o + 1];
        const b = data[o + 2];
        let bestD = Infinity;
        let bestMmh = 0;
        for (const s of SCALE) {
          const dr = r - s.rgb[0];
          const dg = g - s.rgb[1];
          const db = b - s.rgb[2];
          const d = dr * dr + dg * dg + db * db;
          if (d < bestD) {
            bestD = d;
            bestMmh = s.mmh;
          }
        }
        mmh[i] = bestMmh;
      }
      const entry = { w: cw, h: ch, mmh };
      cacheRef.current.set(url, entry);
      while (cacheRef.current.size > DECODE_CACHE_MAX) {
        const firstKey = cacheRef.current.keys().next().value;
        if (firstKey === undefined) break;
        cacheRef.current.delete(firstKey);
      }
      sourceRef.current = entry;
      redraw();
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);




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
        for (let i = 0; i < cw * ch; i++) {
          const o = i * 4;
          const a = data[o + 3];
          if (a < 8) {
            mmh[i] = 0;
            continue;
          }
          const r = data[o];
          const g = data[o + 1];
          const b = data[o + 2];
          let bestD = Infinity;
          let bestMmh = 0;
          for (const s of SCALE) {
            const dr = r - s.rgb[0];
            const dg = g - s.rgb[1];
            const db = b - s.rgb[2];
            const d = dr * dr + dg * dg + db * db;
            if (d < bestD) {
              bestD = d;
              bestMmh = s.mmh;
            }
          }
          mmh[i] = bestMmh;
        }
        cacheRef.current.set(u, { w: cw, h: ch, mmh });
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
    const src = sourceRef.current;
    if (!cv || !src) return;
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
    const cacheKey = `${url}|${viewKey}`;
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

      const sw = src.w;
      const sh = src.h;
      const smoothMmh = ensureSmooth(src);
      const sampleAt = (fx: number, fy: number) => {
        const x0 = Math.max(0, Math.min(sw - 1, Math.floor(fx)));
        const y0 = Math.max(0, Math.min(sh - 1, Math.floor(fy)));
        const x1 = Math.min(sw - 1, x0 + 1);
        const y1 = Math.min(sh - 1, y0 + 1);
        const tx = Math.max(0, Math.min(1, fx - x0));
        const ty = Math.max(0, Math.min(1, fy - y0));
        const v00 = smoothMmh[y0 * sw + x0];
        const v01 = smoothMmh[y0 * sw + x1];
        const v10 = smoothMmh[y1 * sw + x0];
        const v11 = smoothMmh[y1 * sw + x1];
        return (
          v00 * (1 - tx) * (1 - ty) +
          v01 * tx * (1 - ty) +
          v10 * (1 - tx) * ty +
          v11 * tx * ty
        );
      };

      for (let ly = 0; ly < lowH; ly++) {
        for (let lx = 0; lx < lowW; lx++) {
          const ll = map.containerPointToLatLng([lx * STEP, ly * STEP]);
          if (ll.lat < minLat || ll.lat > maxLat || ll.lng < minLon || ll.lng > maxLon) continue;
          const fx = ((ll.lng - minLon) / lonSpan) * (src.w - 1);
          const fy = ((maxLat - ll.lat) / latSpan) * (src.h - 1);
          if (fx < 0 || fx > src.w - 1 || fy < 0 || fy > src.h - 1) continue;
          const v = sampleAt(fx, fy);
          if (v < 0.05) continue;
          const [r, g, b, a] = colorFor(v);
          if (a === 0) continue;
          const alpha = Math.round(a * 255);
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
  }, [payload, bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon]);

  return null;
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


function timelineColorFor(frame: RadarFrame | null): string {
  return frame?.source === "radar" ? MEASUREMENT_COLOR : FORECAST_COLOR;
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





function fmtBubble(d: Date, frame: RadarFrame | null): string {
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const kind = frame?.source === "radar" ? "Messung" : "Prognose";
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
    queryKey: ["radar-frames"],
    queryFn: () => getRadarFrames(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
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

  // Play-Schritt-Indizes zielzeitgesteuert:
  //   Messung (t <= now) : 5-min-Raster
  //   Prognose           : durchgehend 15-min-Raster bis zum Ende
  // Pro Zielzeit wird der nächstgelegene Frame innerhalb einer Toleranz
  // (= 0.5 × Schrittgrösse) gewählt. Hat eine Phase nur grobere Daten,
  // werden Zielzeiten ohne passenden Frame übersprungen statt denselben
  // Frame mehrfach aufzunehmen.
  const playStepIndices = useMemo(() => {
    if (frames.length === 0) return [] as number[];
    const times = frames.map((f) => Date.parse(f.t));
    const firstMs = times[0];
    const lastMs = times[times.length - 1];
    const nowMs = Date.now();

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
    let lastPicked = -1;
    const pushTarget = (targetMs: number, stepMs: number) => {
      const idx = pickNearest(targetMs, stepMs * 0.5);
      if (idx === null || idx === lastPicked) return;
      out.push(idx);
      lastPicked = idx;
    };

    // Phase Messung: 5-min-Raster bis nowMs.
    const STEP5 = 5 * 60_000;
    const startMeas = Math.ceil(firstMs / STEP5) * STEP5;
    const endMeas = Math.floor(nowMs / STEP5) * STEP5;
    for (let t = startMeas; t <= endMeas; t += STEP5) {
      pushTarget(t, STEP5);
    }

    // Phase Prognose: 15-min-Raster bis zum letzten verfügbaren Frame.
    const STEP15 = 15 * 60_000;
    const startFc15 = Math.ceil((nowMs + 1) / STEP15) * STEP15;
    for (let t = startFc15; t <= lastMs; t += STEP15) {
      pushTarget(t, STEP15);
    }
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

  const stepCursorForIndex = (cur: number | null): number => {
    if (playStepIndices.length === 0 || cur === null) return 0;
    const exact = playStepIndices.indexOf(cur);
    if (exact >= 0) return exact;
    let cursor = 0;
    for (let i = 0; i < playStepIndices.length; i++) {
      if (playStepIndices[i] <= cur) cursor = i;
      else break;
    }
    return cursor;
  };

  const setTimelineToIndex = (target: number | null) => {
    if (target === null || !frames[target]) return;
    const targetMs = Date.parse(frames[target].t);
    setIdx(target);
    setRenderMs(targetMs);
    setPlayVisualMs(null);
    setScrubVisualMs(null);
  };

  // Play-Loop: kontinuierliche Zeitachse. Kein Quellen-Sonderfall am Seam;
  // Play und Scrub werden später über denselben Timeline-Sampler gerendert.
  const playTimeRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playing || playStepIndices.length === 0 || frames.length === 0) {
      playTimeRef.current = null;
      setPlayVisualMs(null);
      return;
    }

    const FRAME_MS = 1800 / speed;
    const REF_GAP_MS = 15 * 60_000;
    let raf = 0;
    let last = performance.now();
    const firstIdx = playStepIndices[0];
    const lastIdx = playStepIndices[playStepIndices.length - 1];
    const startIdx = playStepIndices[stepCursorForIndex(idxRef.current)] ?? firstIdx;
    const firstMs = Date.parse(frames[firstIdx]?.t ?? frames[0].t);
    const lastMs = Date.parse(frames[lastIdx]?.t ?? frames[frames.length - 1].t);
    const idxMs = Date.parse(frames[startIdx]?.t ?? frames[idxRef.current ?? 0]?.t ?? frames[0].t);
    const startMs = Math.max(firstMs, Math.min(lastMs, scrubVisualMs ?? renderMsRef.current ?? idxMs));
    playTimeRef.current = startMs;
    setPlayVisualMs(startMs);
    setRenderMs(startMs);

    let lastFlush = performance.now();
    const FLUSH_MS = 140;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const prevMs = playTimeRef.current ?? startMs;
      const nextMs = prevMs + (dt * REF_GAP_MS) / FRAME_MS;
      if (nextMs >= lastMs) {
        playTimeRef.current = lastMs;
        setPlayVisualMs(lastMs);
        setRenderMs(lastMs);
        const endIdx = nearestFrameIndexForMs(frames, lastMs);
        idxRef.current = endIdx;
        setIdx(endIdx);
        setPlaying(false);
        return;
      }
      playTimeRef.current = nextMs;
      renderMsRef.current = nextMs;
      // React-State nur gedrosselt anfassen: Overlays lesen aus Props, die
      // sich pro Tick sonst ändern und teure Redraws auslösen würden. Die
      // Karte selbst bewegt sich zwischen 15-min-Rasterframes optisch nicht,
      // daher reicht ~7Hz Update-Frequenz für Bubble/Label/Idx.
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
  }, [playing, speed, playStepIndices, frames]);

  const currentFrame = idx !== null ? frames[idx] ?? null : null;
  // Der sichtbare Zustand wird unten über `timelineStateForMs` kontinuierlich
  // zwischen den benachbarten Frames gerendert.


  // Reduzierte Frame-Liste für den Filmstrip — gleiche Cadence wie Play
  // (5 min Messung / durchgehend 15 min Prognose).
  const stripFrames = useMemo(
    () => playStepIndices.map((i) => frames[i]).filter(Boolean) as RadarFrame[],
    [playStepIndices, frames],
  );
  // Alle Radar-PNG-URLs für Pre-Decode (Scrub ohne Stocker).
  const radarUrls = useMemo(
    () =>
      frames
        .filter((f) => f.source === "radar" && !!f.precipUrl)
        .map((f) => f.precipUrl as string),
    [frames],
  );

  const stripIdx = idx !== null ? stepCursorForIndex(idx) : 0;
  const stripNowIdx = useMemo(() => {
    if (playStepIndices.length === 0) return 0;
    let best = 0;
    let bestDt = Infinity;
    for (let i = 0; i < playStepIndices.length; i++) {
      const dt = Math.abs(playStepIndices[i] - nowIdx);
      if (dt < bestDt) {
        bestDt = dt;
        best = i;
      }
    }
    return best;
  }, [playStepIndices, nowIdx]);


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
          minZoom={8}
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
              const overlayFrame = timelineState.frame ?? currentFrame;
              const overlayNext = timelineState.nextFrame;
              const overlayProg = timelineState.progress;

              const hasPng = !!overlayFrame?.precipUrl;
              const hasGrid = Array.isArray(overlayFrame?.values) && overlayFrame.values.length > 0;
              const nextHasGrid = Array.isArray(overlayNext?.values) && overlayNext.values.length > 0;
              const ib = overlayFrame?.imageBbox ?? data.imageBbox;
              const opacityVal = 0.6;

              const showPng = !!overlayFrame && hasPng;
              const showGrid = !!overlayFrame && hasGrid && !hasPng;
              const warmGrid = !!overlayFrame && hasPng && !!overlayNext && nextHasGrid;
              const gridFrame = showGrid ? overlayFrame : warmGrid ? overlayNext : null;

              return (
                <>
                  {gridFrame && (
                    <PrecipOverlay
                      payload={data}
                      frame={gridFrame}
                      nextFrame={showGrid ? overlayNext : null}
                      progress={showGrid ? overlayProg : 0}
                      opacity={showGrid ? opacityVal : 0}
                      prewarmFrames={frames}
                    />
                  )}
                  {showPng && (
                    <MeasurementCanvasOverlay
                      url={overlayFrame.precipUrl as string}
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




          {RADAR_CITIES.map((c, i) => (
            <ZoomGate key={`${c.name}-${c.lat}-${c.lon}-${i}`} minZoom={c.minZoom ?? 10.5}>
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






        {/* Legende oben rechts (unter Zoom) */}
        <div className="pointer-events-none absolute right-3 top-24 z-[400] flex flex-col gap-0.5 rounded-md bg-card/95 p-1.5 text-[9px] shadow-md sm:p-2 sm:text-[10px]">
          <span className="mb-1 font-semibold text-foreground">mm/h</span>
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
        </div>

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
                      const ni = Math.max(0, stripIdx - 1);
                      const target = playStepIndices[ni];
                      if (typeof target === "number") setTimelineToIndex(target);
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
                      const target = playStepIndices[stripNowIdx];
                      if (typeof target === "number") setTimelineToIndex(target);
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
                      frames={stripFrames.map((f) => ({ ms: Date.parse(f.t) }))}
                      idx={stripIdx}
                      isMobile={isMobile}
                      playing={playing}
                      visualMs={scrubVisualMs ?? playVisualMs ?? renderMs}
                      color={(() => {
                        const f = stripFrames[stripIdx] ?? null;
                        return timelineColorFor(f);
                      })()}
                      bandMode="measurement-forecast"
                      ariaLabel="Radar-Zeit"
                      formatBubble={(d) => {
                        // Frame anhand der Bubble-Zeit bestimmen (nächster in stripFrames).
                        const target = d.getTime();
                        let best: RadarFrame | null = null;
                        let bestDt = Infinity;
                        for (const f of stripFrames) {
                          const dt = Math.abs(Date.parse(f.t) - target);
                          if (dt < bestDt) { bestDt = dt; best = f; }
                        }
                        return fmtBubble(d, best);
                      }}
                      onScrubMs={(ms) => {
                        setScrubVisualMs(ms);
                        if (ms !== null) setRenderMs(ms);
                      }}
                      onChange={(i: number) => {
                        const target = playStepIndices[i];
                        if (typeof target === "number") setTimelineToIndex(target);
                        setPlaying(false);
                      }}
                    />
                  </div>


                  {/* Next */}
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      const ni = Math.min(playStepIndices.length - 1, stripIdx + 1);
                      const target = playStepIndices[ni];
                      if (typeof target === "number") setTimelineToIndex(target);
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
          Aktualisiert am {fmtUpdatedAt(data.generatedAt)} · Quellen: MeteoSchweiz Radar (Messung &amp; Hagel-POH) · MeteoSchweiz ICON-CH1 (Nowcast) und ICON-seamless (Vorhersage bis +48 h)
        </p>
      )}
    </div>
  );
}
