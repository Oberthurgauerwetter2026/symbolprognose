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

// estimateAdvection entfernt: advektives Resampling in der Prognose verursachte
// sichtbares Wackeln der Niederschlagsbänder zwischen Framepaaren.





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
  contour = false,
}: {
  payload: RadarPayload;
  frame: RadarFrame | null;
  nextFrame?: RadarFrame | null;
  progress?: number;
  opacity?: number;
  contour?: boolean;
}) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<L.Layer | null>(null);

  // Advektives Resampling wurde entfernt — pro Framepaar wechselnde Shift-
  // Vektoren liessen die Prognose-Bänder sichtbar wackeln. Jetzt nur weicher
  // Crossfade zwischen den Frames.




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
        (cv.style as unknown as { imageRendering: string }).imageRendering = "pixelated";

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
  const CACHE_MAX = 64;

  const redrawRef = useRef<() => void>(() => {});
  function redraw() {
    redrawRef.current();
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
    const vals = frame.values;
    const snowVals = frame.snowValues;
    const STEP = contour ? 2 : 1;
    const lowWForView = Math.max(1, Math.ceil(size.x / STEP));
    const lowHForView = Math.max(1, Math.ceil(size.y / STEP));

    // View-Key — Cache invalidiert bei Pan/Zoom/Resize/DPR-Wechsel.
    const center = map.getCenter();
    const viewKey = `${map.getZoom()}|${size.x}x${size.y}|${dpr}|${center.lat.toFixed(4)}|${center.lng.toFixed(4)}|${STEP}|${contour ? "f" : "m"}`;
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
      const contourScale = contour ? new Float32Array(lowWForView * lowHForView) : undefined;

      const hash = (ix: number, iy: number) => {
        let h = (ix * 374761393 + iy * 668265263 + 1013904223) | 0;
        h = (h ^ (h >>> 13)) * 1274126177;
        h = h ^ (h >>> 16);
        return ((h >>> 0) % 10000) / 10000;
      };
      const smooth = (u: number) => u * u * (3 - 2 * u);
      const valueNoise = (x: number, y: number) => {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const fxN = smooth(x - ix);
        const fyN = smooth(y - iy);
        const a = hash(ix, iy);
        const b = hash(ix + 1, iy);
        const c = hash(ix, iy + 1);
        const d = hash(ix + 1, iy + 1);
        return a * (1 - fxN) * (1 - fyN) + b * fxN * (1 - fyN) + c * (1 - fxN) * fyN + d * fxN * fyN;
      };
      const fbm = (x: number, y: number) => {
        let v = 0;
        let amp = 0.5;
        let freq = 1;
        for (let o = 0; o < 5; o++) {
          v += valueNoise(x * freq, y * freq) * amp;
          amp *= 0.5;
          freq *= 2.1;
        }
        return v;
      };
      const COS = 0.866;
      const SIN = 0.5;

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

          if (contourScale) {
            const sx = fxRaw * 0.9;
            const sy = fyRaw * 0.85;
            const rx = sx * COS - sy * SIN;
            const ry = sx * SIN + sy * COS;
            const warpX = (fbm(rx * 0.35 + 17.3, ry * 0.35 - 4.1) - 0.5) * 2.6;
            const warpY = (fbm(rx * 0.35 - 9.7, ry * 0.35 + 23.4) - 0.5) * 2.6;
            const n = fbm(rx + warpX, ry + warpY);
            const mod = 0.25 + n * 1.55;
            const env1 = fbm(rx * 0.11 - 5.7, ry * 0.11 + 11.2);
            const env2 = fbm(rx * 0.45 + 31.1, ry * 0.45 - 7.4);
            const env3 = fbm(rx * 1.6 - 17.9, ry * 1.6 + 4.3);
            const envRaw = env1 * 0.5 + env2 * 0.35 + env3 * 0.15;
            const edgeNX = Math.min(fxRaw, nLon - 1 - fxRaw) / (nLon - 1);
            const edgeNY = Math.min(fyRaw, nLat - 1 - fyRaw) / (nLat - 1);
            const edgeRaw = Math.max(0, Math.min(edgeNX, edgeNY)) * 2;
            const edgeJitter = 0.55 + fbm(rx * 0.55 + 71.3, ry * 0.55 - 19.8) * 0.9;
            const edgeMask = Math.max(0, Math.min(1, edgeRaw * edgeJitter));
            const envelope = Math.max(0, envRaw * 2.9 - 1.05) * edgeMask;
            contourScale[cell] = mod * envelope;
          }
        }
      }
      lookup = { key: viewKey, lowW: lowWForView, lowH: lowHForView, fx, fy, valid, contourScale };
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

          let v = sampleAt(vals, fxRaw, fyRaw);

          if (contour && v > 0 && lookup.contourScale) {
            v = v * lookup.contourScale[cell];
          }

          const minV = contour ? 0.05 : 0.1;
          if (v < minV) continue;

          let snowFrac = 0;
          if (snowVals) {
            const sv = sampleAt(snowVals, fxRaw, fyRaw);
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

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, lowW, lowH, 0, 0, size.x, size.y);
    ctx.restore();
  };

  // Nur bei tatsächlichem Frame-Wechsel neu zeichnen — keine Per-RAF-Repaints
  // (Desktop-Performance). Kein Crossfade/Lerp mehr.
  useEffect(() => {
    redrawRef.current();
  }, [frame, payload]);

  // Canvas-Opacity nachziehen (Soft-Blending Nowcast↔ICON-CH1).
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
}: {
  url: string;
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  opacity: number;
}) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<L.Layer | null>(null);
  const sourceRef = useRef<{ w: number; h: number; mmh: Float32Array } | null>(null);
  const cacheRef = useRef<Map<string, { w: number; h: number; mmh: Float32Array }>>(new Map());
  const DECODE_CACHE_MAX = 8;

  const redrawRef = useRef<() => void>(() => {});
  function redraw() {
    redrawRef.current();
  }

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
        (cv.style as unknown as { imageRendering: string }).imageRendering = "pixelated";

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

  redrawRef.current = () => {
    const cv = canvasRef.current;
    const src = sourceRef.current;
    if (!cv || !src) return;
    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;
    cv.width = size.x * dpr;
    cv.height = size.y * dpr;
    cv.style.width = size.x + "px";
    cv.style.height = size.y + "px";
    const tl = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(cv, tl);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);

    const STEP = 1;
    const lowW = Math.max(1, Math.ceil(size.x / STEP));
    const lowH = Math.max(1, Math.ceil(size.y / STEP));
    const off = document.createElement("canvas");
    off.width = lowW;
    off.height = lowH;
    const offCtx = off.getContext("2d");
    if (!offCtx) return;
    const img = offCtx.createImageData(lowW, lowH);
    const dArr = img.data;
    const { minLat, maxLat, minLon, maxLon } = bounds;
    const latSpan = maxLat - minLat;
    const lonSpan = maxLon - minLon;

    const sampleAt = (fx: number, fy: number) => {
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(src.w - 1, x0 + 1);
      const y1 = Math.min(src.h - 1, y0 + 1);
      const tx = fx - x0;
      const ty = fy - y0;
      const v00 = src.mmh[y0 * src.w + x0];
      const v01 = src.mmh[y0 * src.w + x1];
      const v10 = src.mmh[y1 * src.w + x0];
      const v11 = src.mmh[y1 * src.w + x1];
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
        if (v < 0.1) continue;
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
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, lowW, lowH, 0, 0, size.x, size.y);
    ctx.restore();
    cv.style.opacity = String(Math.max(0, Math.min(1, opacity)));
  };

  useEffect(() => {
    redrawRef.current();
  }, [opacity, bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon]);

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

function fmtDayLong(d: Date): string {
  const wd = WEEKDAY_LONG[d.getDay()];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${wd}, ${dd}.${mm}.${d.getFullYear()}`;
}


function fmtBubble(d: Date, frame: RadarFrame | null): string {
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const kind = frame?.source === "radar" ? "Messung" : "Prognose";
  return `${kind}: ${wd}, ${hh}:${mm}`;
}

function FilmstripTimeline({
  frames,
  idx,
  onChange,
  isMobile,
  playing,
  visualMs,
}: {
  frames: RadarFrame[];
  idx: number;
  onChange: (i: number) => void;
  isMobile: boolean;
  playing: boolean;
  visualMs?: number | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    setContainerW(containerRef.current.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setContainerW(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const PX_PER_HOUR = isMobile ? 56 : 72;
  const times = useMemo(() => frames.map((f) => Date.parse(f.t)), [frames]);
  const tMin = times[0] ?? 0;
  const tMax = times[times.length - 1] ?? 1;
  const nowMs = Date.now();
  const totalWidth = ((tMax - tMin) / 3_600_000) * PX_PER_HOUR;

  const hours = useMemo(() => {
    const start = Math.ceil(tMin / 3_600_000) * 3_600_000;
    const out: { ms: number; left: number; hour: number }[] = [];
    for (let t = start; t <= tMax; t += 3_600_000) {
      out.push({
        ms: t,
        left: ((t - tMin) / 3_600_000) * PX_PER_HOUR,
        hour: new Date(t).getHours(),
      });
    }
    return out;
  }, [tMin, tMax, PX_PER_HOUR]);

  const ticks10 = useMemo(() => {
    const start = Math.ceil(tMin / 600_000) * 600_000;
    const out: number[] = [];
    for (let t = start; t <= tMax; t += 600_000) {
      out.push(((t - tMin) / 3_600_000) * PX_PER_HOUR);
    }
    return out;
  }, [tMin, tMax, PX_PER_HOUR]);

  const dayBreaks = hours.filter((h) => h.hour === 0);

  const [dragMs, setDragMs] = useState<number | null>(null);
  const dragging = dragMs !== null;
  const lastSentIdxRef = useRef<number>(idx);
  useEffect(() => {
    if (!dragging) lastSentIdxRef.current = idx;
  }, [dragging, idx]);

  const nearestIndexForMs = (target: number): number => {
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
  const dragIdx = dragMs !== null ? nearestIndexForMs(dragMs) : idx;
  const displayIdx = dragging ? dragIdx : idx;
  const frameMs = times[displayIdx] ?? tMin;
  // Bubble/Marker laufen kontinuierlich (Drag oder Play-Interpolation),
  // das Radar-Bild bleibt frame-genau (currentFrame = frames[displayIdx]).
  const currentMs = dragging
    ? (dragMs as number)
    : visualMs != null
      ? visualMs
      : frameMs;
  const translateX = containerW / 2 - ((currentMs - tMin) / 3_600_000) * PX_PER_HOUR;
  const nowLeft = Math.max(0, Math.min(totalWidth, ((nowMs - tMin) / 3_600_000) * PX_PER_HOUR));
  const currentFrame = frames[displayIdx] ?? null;
  const timelineColor = timelineColorFor(currentFrame);
  const bubbleLabel = fmtBubble(new Date(currentMs), currentFrame);
  const dayLabel = fmtDayLong(new Date(currentMs));

  const dragStartRef = useRef<{ x: number; ms: number } | null>(null);
  const rafPendingRef = useRef<number | null>(null);
  const pendingTargetRef = useRef<number | null>(null);
  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, ms: currentMs };
    setDragMs(currentMs);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(6); } catch { /* ignore */ }
    }
  };
  const snapAndEmit = (target: number) => {
    const best = nearestIndexForMs(target);
    if (best !== lastSentIdxRef.current) {
      lastSentIdxRef.current = best;
      onChange(best);
    }
    return best;
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dMs = (-dx / PX_PER_HOUR) * 3_600_000;
    const target = Math.max(tMin, Math.min(tMax, dragStartRef.current.ms + dMs));
    pendingTargetRef.current = target;
    if (rafPendingRef.current !== null) return;
    rafPendingRef.current = requestAnimationFrame(() => {
      rafPendingRef.current = null;
      const t = pendingTargetRef.current;
      if (t === null) return;
      // Idx auf nächsten Cadence-Frame snappen (hartes Bild-Schalten),
      // aber Bubble/Marker am kontinuierlichen Drag-Wert lassen.
      snapAndEmit(t);
      setDragMs(t);
    });
  };
  const onUp = (e: React.PointerEvent) => {
    dragStartRef.current = null;
    if (rafPendingRef.current !== null) {
      cancelAnimationFrame(rafPendingRef.current);
      rafPendingRef.current = null;
    }
    pendingTargetRef.current = null;
    setDragMs(null);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="select-none">
      {/* Bubble über fixer Mittellinie */}
      <div className="relative h-7">
        <div className="pointer-events-none absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center">
          <span
            className="whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold text-white shadow-md"
            style={{ background: timelineColor }}
          >
            {bubbleLabel}
          </span>
          <span
            className="h-0 w-0"
            style={{
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: `5px solid ${timelineColor}`,
            }}
          />
        </div>
      </div>

      {/* Filmstreifen */}
      <div
        ref={containerRef}
        role="slider"
        aria-label="Radar-Zeit"
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
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative h-12 cursor-grab touch-none overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-b from-neutral-50 to-neutral-100 shadow-inner outline-none active:cursor-grabbing focus-visible:ring-2"
        style={{ ['--tw-ring-color' as never]: timelineColor }}
      >
        {/* Fixe Mittel-Linie */}
        <span className="pointer-events-none absolute left-1/2 top-0 z-30 h-full w-px -translate-x-1/2 bg-neutral-900/85" />
        <span
          className="pointer-events-none absolute left-1/2 top-0 z-30 h-2 w-2 -translate-x-1/2 rotate-45"
          style={{ background: timelineColor }}
        />

        {/* Scrollender Strip */}
        <div
          className="absolute inset-y-0 left-0 will-change-transform"
          style={{
            width: `${totalWidth}px`,
            transform: `translate3d(${translateX}px,0,0)`,
            transition: dragging || playing ? "none" : "transform 220ms cubic-bezier(.22,1,.36,1)",
          }}
        >
          {/* Messungs-Band (grau) */}
          <div
            className="absolute top-6 h-4 rounded-sm"
            style={{ left: 0, width: nowLeft, background: FILMSTRIP_MEASUREMENT_COLOR, opacity: 0.6 }}
          />
          {/* Prognose-Band (blau, kräftiger) */}
          <div
            className="absolute top-6 h-4 rounded-sm"
            style={{
              left: nowLeft,
              width: Math.max(0, totalWidth - nowLeft),
              background: FILMSTRIP_FORECAST_COLOR,
              opacity: 0.68,
            }}
          />

          {/* 10-min-Ticks */}
          {ticks10.map((l, i) => (
            <span
              key={`m10-${i}`}
              className="absolute top-7 h-2 w-px bg-white/45"
              style={{ left: l }}
            />
          ))}

          {/* Stunden-Ticks + Labels */}
          {hours.map((h) => (
            <div key={`h-${h.ms}`} className="absolute top-0 h-full" style={{ left: h.left }}>
              <span className="absolute top-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tabular-nums text-neutral-600">
                {String(h.hour).padStart(2, "0")}:00
              </span>
              <span className="absolute top-6 h-4 w-px bg-neutral-900/40" />
            </div>
          ))}

          {/* Tageswechsel */}
          {dayBreaks.map((b) => (
            <span
              key={`db-${b.ms}`}
              className="absolute top-6 h-4 w-[2px] bg-neutral-900/70"
              style={{ left: b.left }}
            />
          ))}

          {/* "Jetzt"-Marker im Strip */}
          {nowLeft > 0 && nowLeft < totalWidth && (
            <span
              className="absolute top-5 h-6 w-[2px] bg-neutral-950"
              style={{ left: nowLeft }}
            />
          )}
        </div>
      </div>

      {/* Tages-Label unter dem Streifen */}
      <div className="mt-1 text-center text-[10px] font-semibold tabular-nums text-neutral-500">
        {dayLabel}
      </div>
    </div>
  );
}








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
  // Kontinuierliche, weich interpolierte Zeit während Play für Bubble/Marker.
  // Das Radar-Bild selbst bleibt frame-genau (kein Crossfading).
  const [playVisualMs, setPlayVisualMs] = useState<number | null>(null);

  // progress-State entfernt: PrecipOverlay zeichnet keine Inter-Frame-Lerp mehr.
  const isMobile = useIsMobile();



  // Auf "jetzt" springen sobald Daten da sind.
  useEffect(() => {
    if (idx === null && frames.length > 0) setIdx(nowIdx);
  }, [nowIdx, frames.length, idx]);

  // Play-Schritt-Indizes mit gemischter Cadence:
  //   Messung (t <= now)       : 5-min-Takt
  //   Prognose 0–24 h          : 15-min-Takt
  //   Prognose > +24 h         : 1-h-Takt
  // Pro Bucket wird der erste passende Frame übernommen.
  const playStepIndices = useMemo(() => {
    if (frames.length === 0) return [] as number[];
    const out: number[] = [];
    const times = frames.map((f) => Date.parse(f.t));
    const nowMs = Date.now();
    const cutoff24 = nowMs + 24 * 3600_000;
    let lastBucketKey: string | null = null;
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      const bucketSize =
        t <= nowMs ? 5 * 60_000 : t <= cutoff24 ? 15 * 60_000 : 60 * 60_000;

      const bucket = Math.floor(t / bucketSize);
      const key = `${bucketSize}:${bucket}`;
      if (key !== lastBucketKey) {
        out.push(i);
        lastBucketKey = key;
      }
    }
    return out;
  }, [frames]);

  const idxRef = useRef<number | null>(null);
  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);

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

  // Play-Loop: fester Cursor in der Step-Liste. Kein Wrap von Prognose-Ende
  // zurück zur Messung; am Ende stoppt Play sauber.
  const progressRef = useRef(0);
  const playCursorRef = useRef(0);
  useEffect(() => {
    if (!playing || playStepIndices.length === 0) {
      progressRef.current = 0;
      setPlayVisualMs(null);
      return;
    }
    progressRef.current = 0;
    playCursorRef.current = stepCursorForIndex(idxRef.current);
    const anchor = playStepIndices[playCursorRef.current];
    if (typeof anchor === "number" && idxRef.current !== anchor) {
      idxRef.current = anchor;
      setIdx(anchor);
    }

    const FRAME_MS = 1800 / speed;
    let raf = 0;
    let last = performance.now();
    const emitVisual = () => {
      const cur = playCursorRef.current;
      const aIdx = playStepIndices[cur];
      const nIdx = playStepIndices[cur + 1] ?? aIdx;
      const aFrame = frames[aIdx];
      const nFrame = frames[nIdx];
      if (!aFrame) return;
      const aMs = Date.parse(aFrame.t);
      const nMs = nFrame ? Date.parse(nFrame.t) : aMs;
      const p = progressRef.current;
      setPlayVisualMs(aMs + (nMs - aMs) * p);
    };
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      let p = progressRef.current + dt / FRAME_MS;
      if (p >= 1) {
        p = p - 1;
        if (p >= 1) p = 0;
        const nextCursor = playCursorRef.current + 1;
        if (nextCursor >= playStepIndices.length) {
          progressRef.current = 0;
          setPlayVisualMs(null);
          setPlaying(false);
          return;
        }
        playCursorRef.current = nextCursor;
        const nextIdx = playStepIndices[nextCursor];
        idxRef.current = nextIdx;
        setIdx(nextIdx);
      }
      progressRef.current = p;
      emitVisual();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setPlayVisualMs(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, playStepIndices]);

  const currentFrame = idx !== null ? frames[idx] ?? null : null;
  // Kein Crossfade — jeder Frame schaltet hart auf den nächsten.


  // Reduzierte Frame-Liste für den Filmstrip — gleiche Cadence wie Play
  // (5 min Messung / 15 min 0–24 h / 60 min > 24 h).
  const stripFrames = useMemo(
    () => playStepIndices.map((i) => frames[i]).filter(Boolean) as RadarFrame[],
    [playStepIndices, frames],
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
              const hasPng = !!currentFrame.precipUrl;
              const hasGrid = Array.isArray(currentFrame.values) && currentFrame.values.length > 0;
              const ib = currentFrame.imageBbox ?? data.imageBbox;
              const opacityVal = 0.6;

              return (
                <>
                  {hasGrid && !hasPng && (
                    <PrecipOverlay
                      payload={data}
                      frame={currentFrame}
                      opacity={opacityVal}
                      contour={currentFrame.source !== "radar"}
                    />
                  )}
                  {currentFrame.precipUrl && (
                    <MeasurementCanvasOverlay
                      url={currentFrame.precipUrl}
                      bounds={ib}
                      opacity={opacityVal}
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

        {/* Steuerung — schwebendes Overlay-Panel unten in der Karte */}
        <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[450] sm:inset-x-3 sm:bottom-3">
          <div className="pointer-events-auto rounded-xl border border-neutral-200/80 bg-white/90 p-2 text-neutral-900 shadow-lg backdrop-blur sm:p-2.5">
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
                      if (typeof target === "number") setIdx(target);
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
                      if (typeof target === "number") setIdx(target);
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
                      frames={stripFrames}
                      idx={stripIdx}
                      isMobile={isMobile}
                      playing={playing}
                      onChange={(i: number) => {
                        const target = playStepIndices[i];
                        if (typeof target === "number") setIdx(target);
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
                      if (typeof target === "number") setIdx(target);
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
